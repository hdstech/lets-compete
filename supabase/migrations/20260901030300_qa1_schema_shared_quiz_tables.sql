-- QA1 · Schema migration — shared core + quiz format tables
--
-- Creates the V1 relational core: the shared results engine (events, rounds,
-- segments, participants, round_participants, result_*) plus the quiz-format
-- fact tables (questions, question_acceptable_answers, answers,
-- integrity_events). Mirrors the data model in event-scoring-app-plan.md.
--
-- Conventions:
--   * UUID primary keys (`gen_random_uuid()`), matching Supabase norms and
--     avoiding id enumeration.
--   * Native enums for closed domains, continuing the pattern set by QA0's
--     `event_format`. Enum values marked "reserved" belong to later tickets/V2.
--   * `created_at`/`updated_at` are timestamptz defaulting to now(); RPCs set
--     `updated_at` explicitly (no auto-touch trigger in V1).
--   * RLS is ENABLED on every table with NO policies = deny-by-default, so the
--     tables are never exposed through PostgREST before QA2 writes policies.
--     (Enabling RLS is not the same as writing access rules; QA2 owns those.)
--
-- Not in scope here: RLS policies (QA2), lifecycle/answer immutability triggers
-- beyond the format guard (QA11), and the judged/V2 tables.

-- ---------------------------------------------------------------------------
-- Enums (closed domains)
-- ---------------------------------------------------------------------------
create type public.event_status              as enum ('draft', 'active', 'concluded');
create type public.round_advancement_type    as enum ('top_n', 'threshold_score', 'all'); -- V1 uses 'top_n'; others reserved
create type public.round_status              as enum ('pending', 'scoring_open', 'scoring_closed', 'advanced');
create type public.participant_type          as enum ('individual', 'team');
create type public.participant_status        as enum ('eligible', 'disqualified', 'withdrawn');
create type public.admission_status          as enum ('pending', 'approved', 'revoked');
create type public.round_participant_status  as enum ('active', 'advanced', 'eliminated');
create type public.question_answer_type      as enum ('text', 'numeric');
create type public.question_status           as enum ('pending', 'revealed', 'window_open', 'window_closed', 'voided');
create type public.integrity_event_kind      as enum ('hidden', 'blur', 'return', 'beforeunload', 'auto_submit');
create type public.result_exclusion_type     as enum ('participant', 'judge'); -- 'judge' reserved for V2

-- ---------------------------------------------------------------------------
-- profiles — mirrors auth.users (populated by a trigger/RPC in T4)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  email      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events — one competition; `format` is immutable (QA0)
-- ---------------------------------------------------------------------------
create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  event_date            date,
  organizer_id          uuid not null references public.profiles (id),
  format                public.event_format not null,
  status                public.event_status not null default 'draft',
  has_rounds            boolean not null default false,
  winner_participant_id uuid,  -- FK added after participants exists (circular dep)
  concluded_at          timestamptz,
  join_code             text not null unique,
  created_at            timestamptz not null default now()
);

-- Bind QA0's immutability guard: reject any UPDATE that changes events.format.
create trigger events_format_immutable
  before update on public.events
  for each row
  execute function public.prevent_event_format_change();

-- ---------------------------------------------------------------------------
-- rounds — elimination stages (>=1; a no-rounds event has one implicit round)
-- ---------------------------------------------------------------------------
create table public.rounds (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  name               text not null,
  sequence           integer not null,
  advancement_type   public.round_advancement_type not null default 'top_n',
  advancement_n      integer,           -- NULL on the final round
  is_final_round     boolean not null,
  status             public.round_status not null default 'pending',
  scoring_opened_at  timestamptz,
  scoring_closed_at  timestamptz,
  advanced_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (event_id, sequence),
  constraint rounds_final_has_no_advancement_n check (is_final_round = (advancement_n is null))
);

-- ---------------------------------------------------------------------------
-- segments — subdivisions of a round
-- ---------------------------------------------------------------------------
create table public.segments (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.rounds (id) on delete cascade,
  name       text not null,
  sequence   integer not null,
  created_at timestamptz not null default now(),
  unique (round_id, sequence)
);

-- ---------------------------------------------------------------------------
-- participants — individuals or teams; quiz self-register identity fields
-- ---------------------------------------------------------------------------
create table public.participants (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  name             text not null,
  type             public.participant_type not null,
  members          text,              -- teams only
  status           public.participant_status not null default 'eligible',
  user_id          uuid references public.profiles (id),  -- the participant's login (quiz self-register)
  admission_status public.admission_status not null default 'pending',
  created_at       timestamptz not null default now()
);

-- Now that participants exists, wire the deferred events.winner FK.
alter table public.events
  add constraint events_winner_participant_id_fkey
  foreign key (winner_participant_id) references public.participants (id);

-- ---------------------------------------------------------------------------
-- Results: permanent, versioned, immutable
-- ---------------------------------------------------------------------------
create table public.result_calculations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  round_id      uuid references public.rounds (id) on delete cascade,   -- scope dimension
  segment_id    uuid references public.segments (id) on delete cascade, -- scope dimension
  calculated_at timestamptz not null default now(),
  calculated_by uuid not null references public.profiles (id),
  reason        text,
  is_final      boolean not null default false
);

-- At most one is_final = true per (event, round, segment) scope. Nullable scope
-- dims are coalesced to the nil UUID so NULLs collapse to one logical slot.
create unique index result_calculations_one_final_per_scope
  on public.result_calculations (
    event_id,
    coalesce(round_id,   '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(segment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where is_final;

create table public.result_calculation_exclusions (
  id             uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.result_calculations (id) on delete cascade,
  excluded_type  public.result_exclusion_type not null,
  excluded_id    uuid not null,
  note           text
);

create table public.result_calculation_entries (
  id             uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.result_calculations (id) on delete cascade,
  participant_id uuid not null references public.participants (id),
  total_score    integer not null,
  rank           integer not null,
  unique (calculation_id, participant_id)
);

-- ---------------------------------------------------------------------------
-- round_participants — who is active in each round + advancement outcome
-- ---------------------------------------------------------------------------
create table public.round_participants (
  id                         uuid primary key default gen_random_uuid(),
  round_id                   uuid not null references public.rounds (id) on delete cascade,
  participant_id             uuid not null references public.participants (id) on delete cascade,
  status                     public.round_participant_status not null default 'active',
  advanced_by_calculation_id uuid references public.result_calculations (id),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (round_id, participant_id)
);

-- ---------------------------------------------------------------------------
-- questions — the scored unit in quiz mode
-- ---------------------------------------------------------------------------
create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  segment_id       uuid not null references public.segments (id) on delete cascade,
  prompt           text not null,
  answer_type      public.question_answer_type not null,
  window_seconds   integer not null,
  sequence         integer not null,
  is_tiebreak      boolean not null default false,  -- true = drawn from the reserve pool
  status           public.question_status not null default 'pending',
  reveal_token     text,   -- issued at reveal; anchors server-authoritative elapsed time
  revealed_at      timestamptz,
  window_closed_at timestamptz,
  voided_at        timestamptz,
  voided_by        uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  unique (segment_id, sequence)
);

-- ---------------------------------------------------------------------------
-- question_acceptable_answers — the acceptable set powering auto pre-mark
-- ---------------------------------------------------------------------------
create table public.question_acceptable_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  value       text not null,
  is_numeric  boolean not null default false,  -- compare by numeric value rather than normalized string
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- answers — core fact table: participant × question
-- ---------------------------------------------------------------------------
create table public.answers (
  id                uuid primary key default gen_random_uuid(),
  participant_id    uuid not null references public.participants (id) on delete cascade,
  question_id       uuid not null references public.questions (id) on delete cascade,
  round_id          uuid not null references public.rounds (id) on delete cascade,   -- denormalized for scope/index
  segment_id        uuid not null references public.segments (id) on delete cascade, -- denormalized for query/index
  submitted_text    text,
  submitted_at      timestamptz,
  is_saved_draft    boolean not null default false,  -- true = arrived via sendBeacon / reconnect replay
  client_elapsed_ms integer,                          -- reported elapsed against reveal_token
  auto_correct      boolean,                          -- provisional, from the matcher
  final_correct     boolean,                          -- grader-adjudicated; sums to points
  graded_by         uuid references public.profiles (id),
  graded_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (participant_id, question_id)
);

-- ---------------------------------------------------------------------------
-- integrity_events — focus/away audit for the grader
-- ---------------------------------------------------------------------------
create table public.integrity_events (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  question_id    uuid references public.questions (id) on delete cascade,
  kind           public.integrity_event_kind not null,
  occurred_at    timestamptz not null,
  duration_ms    integer,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes on foreign keys / common filters (Postgres does not auto-index FKs).
-- Columns already covered by a UNIQUE prefix are omitted.
-- ---------------------------------------------------------------------------
create index events_organizer_id_idx                on public.events (organizer_id);
create index rounds_event_id_idx                    on public.rounds (event_id);
create index segments_round_id_idx                  on public.segments (round_id);
create index participants_event_id_idx              on public.participants (event_id);
create index participants_user_id_idx               on public.participants (user_id);
create index result_calculations_event_id_idx       on public.result_calculations (event_id);
create index result_calculations_round_id_idx       on public.result_calculations (round_id);
create index result_calculations_segment_id_idx     on public.result_calculations (segment_id);
create index result_calc_exclusions_calc_id_idx     on public.result_calculation_exclusions (calculation_id);
create index round_participants_participant_id_idx   on public.round_participants (participant_id);
create index round_participants_calc_id_idx          on public.round_participants (advanced_by_calculation_id);
create index questions_segment_id_idx               on public.questions (segment_id);
create index question_acceptable_answers_q_id_idx    on public.question_acceptable_answers (question_id);
create index answers_question_id_idx                on public.answers (question_id);
create index answers_round_id_idx                   on public.answers (round_id);
create index answers_segment_id_idx                 on public.answers (segment_id);
create index integrity_events_participant_id_idx     on public.integrity_events (participant_id);
create index integrity_events_question_id_idx        on public.integrity_events (question_id);

-- ---------------------------------------------------------------------------
-- RLS: enable deny-by-default on every table. Policies are added in QA2.
-- ---------------------------------------------------------------------------
alter table public.profiles                     enable row level security;
alter table public.events                       enable row level security;
alter table public.rounds                       enable row level security;
alter table public.segments                     enable row level security;
alter table public.participants                 enable row level security;
alter table public.result_calculations          enable row level security;
alter table public.result_calculation_exclusions enable row level security;
alter table public.result_calculation_entries    enable row level security;
alter table public.round_participants            enable row level security;
alter table public.questions                     enable row level security;
alter table public.question_acceptable_answers   enable row level security;
alter table public.answers                       enable row level security;
alter table public.integrity_events              enable row level security;
