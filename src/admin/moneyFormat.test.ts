import { describe, expect, it } from 'vitest'
import { formatMoneyInputFromX10000, parseMoneyInputToX10000 } from './moneyFormat'

describe('formatMoneyInputFromX10000', () => {
  it('converts 0 to "0"', () => {
    expect(formatMoneyInputFromX10000(0)).toBe('0')
  })

  it('converts 10000 to "1"', () => {
    expect(formatMoneyInputFromX10000(10000)).toBe('1')
  })

  it('converts 250000 to "25"', () => {
    expect(formatMoneyInputFromX10000(250000)).toBe('25')
  })

  it('converts 1234 to "0.1234"', () => {
    expect(formatMoneyInputFromX10000(1234)).toBe('0.1234')
  })

  it('converts 12345 to "1.2345"', () => {
    expect(formatMoneyInputFromX10000(12345)).toBe('1.2345')
  })

  it('converts 100 to "0.01"', () => {
    expect(formatMoneyInputFromX10000(100)).toBe('0.01')
  })

  it('converts 1 to "0.0001"', () => {
    expect(formatMoneyInputFromX10000(1)).toBe('0.0001')
  })

  it('converts 50000 to "5" (strips trailing zeros)', () => {
    expect(formatMoneyInputFromX10000(50000)).toBe('5')
  })

  it('converts 10050 to "1.005" (strips trailing zeros)', () => {
    expect(formatMoneyInputFromX10000(10050)).toBe('1.005')
  })

  it('converts 10010 to "1.001"', () => {
    expect(formatMoneyInputFromX10000(10010)).toBe('1.001')
  })

  it('converts 20000 to "2"', () => {
    expect(formatMoneyInputFromX10000(20000)).toBe('2')
  })
})

describe('parseMoneyInputToX10000', () => {
  it('parses "1" to 10000', () => {
    expect(parseMoneyInputToX10000('1')).toBe(10000)
  })

  it('parses "25" to 250000', () => {
    expect(parseMoneyInputToX10000('25')).toBe(250000)
  })

  it('parses "0" to 0', () => {
    expect(parseMoneyInputToX10000('0')).toBe(0)
  })

  it('parses "0.1234" to 1234', () => {
    expect(parseMoneyInputToX10000('0.1234')).toBe(1234)
  })

  it('parses "1.2345" to 12345', () => {
    expect(parseMoneyInputToX10000('1.2345')).toBe(12345)
  })

  it('parses "0.01" to 100', () => {
    expect(parseMoneyInputToX10000('0.01')).toBe(100)
  })

  it('parses "0.0001" to 1', () => {
    expect(parseMoneyInputToX10000('0.0001')).toBe(1)
  })

  it('parses "0.001" to 10', () => {
    expect(parseMoneyInputToX10000('0.001')).toBe(10)
  })

  it('parses "3.05" to 30500', () => {
    expect(parseMoneyInputToX10000('3.05')).toBe(30500)
  })

  // Rejection cases

  it('returns null for empty string', () => {
    expect(parseMoneyInputToX10000('')).toBeNull()
  })

  it('returns null for whitespace string', () => {
    expect(parseMoneyInputToX10000('  ')).toBeNull()
  })

  it('returns null for negative value "-1"', () => {
    expect(parseMoneyInputToX10000('-1')).toBeNull()
  })

  it('returns null for more than 4 decimal places "0.12345"', () => {
    expect(parseMoneyInputToX10000('0.12345')).toBeNull()
  })

  it('returns null for non-numeric "abc"', () => {
    expect(parseMoneyInputToX10000('abc')).toBeNull()
  })

  it('returns null for value with leading dot ".5"', () => {
    expect(parseMoneyInputToX10000('.5')).toBeNull()
  })

  it('returns null for value with trailing dot "1."', () => {
    expect(parseMoneyInputToX10000('1.')).toBeNull()
  })

  it('rejects scientific notation "1e5"', () => {
    expect(parseMoneyInputToX10000('1e5')).toBeNull()
  })
})
