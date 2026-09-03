-- T28 · fix result_calculation_entries.participant_id missing ON DELETE CASCADE
--
-- QA1 gave round_participants.participant_id `on delete cascade` but left
-- result_calculation_entries.participant_id as a bare (restrict) reference.
-- Deleting an event cascades to delete both its participants (events ->
-- participants) and its result_calculations (events -> result_calculations
-- -> result_calculation_entries via calculation_id's own cascade) in the
-- same statement; Postgres doesn't guarantee the entries are gone before it
-- checks the immediate, non-deferrable participant_id FK while deleting
-- participants, so the delete fails with a foreign-key violation whenever
-- an event has any calculated results (T28's own e2e cleanup hit this after
-- calculating a round's results, and the same conflict blocks an organizer
-- from using the existing "Delete event" button on such an event today).
-- Cascading here is correct the same way it is for round_participants: a
-- participant's frozen result-entry rows are meaningless once the
-- participant itself is gone.

alter table public.result_calculation_entries
  drop constraint result_calculation_entries_participant_id_fkey;

alter table public.result_calculation_entries
  add constraint result_calculation_entries_participant_id_fkey
  foreign key (participant_id) references public.participants (id) on delete cascade;
