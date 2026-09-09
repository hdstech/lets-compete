// Mirrors private.parse_numeric_answer in the DB matcher: strips commas and a
// leading dollar sign, then parses as a number.
export function parseNumericAnswer(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/,/g, '').replace(/^\$/, '')
  if (normalized === '' || normalized === '-' || normalized === '.') return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function filterNumericAnswerInput(value: string): string {
  let result = ''
  for (const ch of value) {
    if (/\d/.test(ch) || ch === ',' || ch === '.') {
      result += ch
    } else if (ch === '$' && result === '') {
      result += ch
    } else if (ch === '-' && result === '') {
      result += ch
    }
  }
  return result
}

export function validateAcceptableAnswer(
  value: string,
  isNumeric: boolean,
): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter an acceptable answer value.'
  if (isNumeric && parseNumericAnswer(trimmed) === null) {
    return 'Enter a numeric value (digits, optional decimal, $, or commas).'
  }
  return null
}
