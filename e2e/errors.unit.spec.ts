import { expect, test } from '@playwright/test'
import { classifyError, getErrorMessage } from '../src/lib/errors'

// T38: the classifier's whole job is knowing which errors to rewrite and
// which to leave alone. Getting the second half wrong is the more damaging
// mistake — it would replace a server's specific "scoring is closed" with
// generic filler — so both directions are covered here.

test.describe('classifyError', () => {
  test('rewrites a fetch failure as connection copy', () => {
    const result = classifyError(new TypeError('Failed to fetch'), 'fallback')
    expect(result.kind).toBe('network')
    expect(result.rewritten).toBe(true)
    expect(result.message).toContain('Check your connection')
  })

  // Safari and Firefox word the same failure differently.
  test('recognises the other browsers\' network wording', () => {
    expect(classifyError(new TypeError('Load failed'), 'fallback').kind).toBe('network')
    expect(
      classifyError(new TypeError('NetworkError when attempting to fetch resource.'), 'f').kind,
    ).toBe('network')
  })

  test('rewrites an expired session by PostgREST code', () => {
    const result = classifyError({ code: 'PGRST301', message: 'JWT expired' }, 'fallback')
    expect(result.kind).toBe('auth')
    expect(result.message).toContain('session expired')
  })

  test('rewrites a 401 that carries no code', () => {
    expect(classifyError({ status: 401, message: 'Unauthorized' }, 'fallback').kind).toBe('auth')
  })

  test('rewrites an RLS violation as a permission problem', () => {
    const result = classifyError(
      { code: '42501', message: 'new row violates row-level security policy for table "answers"' },
      'fallback',
    )
    expect(result.kind).toBe('permission')
    expect(result.message).toContain("don't have permission")
  })

  test('rewrites a missing row', () => {
    const result = classifyError(
      { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      'fallback',
    )
    expect(result.kind).toBe('notFound')
  })

  // The important negative case: an RPC that raised its own exception knows
  // why it said no, and that reason must survive untouched.
  test('passes a server-authored message through verbatim', () => {
    const result = classifyError(
      { code: 'P0001', message: 'scoring is closed for this round' },
      'fallback',
    )
    expect(result.kind).toBe('server')
    expect(result.rewritten).toBe(false)
    expect(result.message).toBe('scoring is closed for this round')
  })

  test('passes a plain Error message through verbatim', () => {
    const result = classifyError(new Error('Simulated fetch failure'), 'fallback')
    expect(result.message).toBe('Simulated fetch failure')
    expect(result.kind).toBe('server')
  })

  test('falls back when there is no message at all', () => {
    expect(classifyError({}, 'Failed to load').message).toBe('Failed to load')
    expect(classifyError(null, 'Failed to load').message).toBe('Failed to load')
    expect(classifyError('a bare string', 'Failed to load').message).toBe('Failed to load')
  })
})

test.describe('getErrorMessage', () => {
  test('returns the classified message', () => {
    expect(getErrorMessage({ message: 'scoring is closed' }, 'fallback')).toBe(
      'scoring is closed',
    )
    expect(getErrorMessage(new TypeError('Failed to fetch'), 'fallback')).toContain(
      'Check your connection',
    )
  })
})
