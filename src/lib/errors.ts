// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC/trigger exception) out of a catch
// block. Every feature's `*-api.ts` re-exports this from one place so
// error copy stays consistent app-wide instead of drifting per feature.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}
