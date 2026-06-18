/**
 * Money formatting helpers for admin pricing UI.
 *
 * All internal money values use fixed-point integers (x10000, i.e. 4 decimal places).
 * These helpers convert between internal x10000 integers and UI-facing decimal strings.
 *
 * IMPORTANT: These helpers use string/integer arithmetic exclusively to avoid
 * floating-point money errors (D-07). Never use parseFloat for money values.
 */

const SCALE = 10000
const FRACTIONAL_DIGITS = 4

/**
 * Converts a fixed-point x10000 integer to a display yuan string.
 *
 * Examples:
 *   0       -> "0"
 *   10000   -> "1"
 *   1234    -> "0.1234"
 *   10050   -> "1.005"
 *   50000   -> "5"
 *
 * Trailing zeros in the fractional part are stripped.
 */
export function formatMoneyInputFromX10000(value: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return '0'
  }

  const negative = value < 0
  const abs = negative ? -value : value

  const integerPart = Math.floor(abs / SCALE)
  const fractionalPart = abs % SCALE

  if (fractionalPart === 0) {
    return negative ? `-${integerPart}` : `${integerPart}`
  }

  // Build fractional string with leading zeros, then strip trailing zeros
  let fracStr = fractionalPart.toString().padStart(FRACTIONAL_DIGITS, '0')
  fracStr = fracStr.replace(/0+$/, '')

  return negative
    ? `-${integerPart}.${fracStr}`
    : `${integerPart}.${fracStr}`
}

// Pattern: non-negative decimal with exactly 0-4 fractional digits
const VALID_MONEY_RE = /^(0|[1-9]\d*)(\.\d{1,4})?$/

/**
 * Parses a UI-facing yuan string into a fixed-point x10000 integer.
 *
 * Returns null if the input is invalid:
 *   - Empty or whitespace
 *   - Negative
 *   - Non-numeric
 *   - More than 4 decimal places
 *   - Leading/trailing dots (e.g. ".5" or "1.")
 *   - Scientific notation
 *
 * Uses string/integer arithmetic to avoid floating-point errors.
 */
export function parseMoneyInputToX10000(value: string): number | null {
  const trimmed = value.trim()

  if (trimmed === '') {
    return null
  }

  if (!VALID_MONEY_RE.test(trimmed)) {
    return null
  }

  // Split into integer and fractional parts
  const dotIndex = trimmed.indexOf('.')
  const integerStr = dotIndex === -1 ? trimmed : trimmed.substring(0, dotIndex)
  const fractionalStr = dotIndex === -1 ? '' : trimmed.substring(dotIndex + 1)

  // Integer part as number (already validated: non-negative, no leading zeros except "0")
  const integerValue = parseInt(integerStr, 10)

  // Pad fractional part to exactly 4 digits
  const paddedFractional = fractionalStr.padEnd(FRACTIONAL_DIGITS, '0')

  // Combine using integer arithmetic: integerPart * SCALE + fractionalPart
  return integerValue * SCALE + parseInt(paddedFractional, 10)
}
