import { describe, it, expect } from 'vitest';
import {
  toMillimetres, formatDistance, toMicroseconds, toDurationMicroseconds, formatTime,
  decimalsForResolution, shiftDecimalToInteger, MeasurementError,
} from './measure.js';

describe('exact decimal shifting', () => {
  it('does not use float multiplication', () => {
    // The float trap this module exists to avoid. 1.005 m is a plausible standing
    // broad jump mark, and in IEEE-754 doubles it does not survive the conversion:
    //   1.005 * 1000 === 1004.9999999999999
    // Truncating that gives 1004 mm — a silent 1 mm loss that can reorder a podium.
    expect(1.005 * 1000).not.toBe(1005);
    expect(Math.trunc(1.005 * 1000)).toBe(1004);
    // Exact string shifting is unaffected.
    expect(shiftDecimalToInteger('1.005', 3)).toBe(1005);
    expect(toMillimetres('1.005', 'm')).toBe(1005);
  });

  it('pads and strips correctly', () => {
    expect(shiftDecimalToInteger('132', 1)).toBe(1320);
    expect(shiftDecimalToInteger('0.005', 3)).toBe(5);
    expect(shiftDecimalToInteger('12.40', 3)).toBe(12400);
  });

  it('refuses to silently round away captured precision', () => {
    expect(() => shiftDecimalToInteger('1.3255', 3)).toThrow(MeasurementError);
  });
});

describe('GT-026 — unit normalisation', () => {
  it('treats 132 cm and 1.32 m as the same mark', () => {
    expect(toMillimetres('132', 'cm')).toBe(1320);
    expect(toMillimetres('1.32', 'm')).toBe(1320);
    expect(toMillimetres('1320', 'mm')).toBe(1320);
  });

  it('renders back to metres without drift', () => {
    expect(formatDistance(1320, 'm')).toBe('1.320 m');
    expect(formatDistance(13100, 'm')).toBe('13.100 m');
  });

  it('rejects a negative distance', () => {
    expect(() => toMillimetres('-1.2', 'm')).toThrow(MeasurementError);
  });
});

describe('time normalisation', () => {
  it('parses sprint times to exact microseconds', () => {
    expect(toDurationMicroseconds('5.21', 's')).toBe(5_210_000);
    expect(toDurationMicroseconds('5.35', 's')).toBe(5_350_000);
    expect(toDurationMicroseconds('120.50', 's')).toBe(120_500_000);
  });

  it('rejects a zero or negative completed run duration (§17)', () => {
    expect(() => toDurationMicroseconds('0', 's')).toThrow(/zero or negative/);
    expect(() => toDurationMicroseconds('-1.0', 's')).toThrow();
  });

  it('accepts zero for an INSTANT, which is not a duration', () => {
    // A cycling start gun at t=0 on the event timing reference is legitimate;
    // only an elapsed duration must be strictly positive.
    expect(toMicroseconds('0', 's')).toBe(0);
    expect(toMicroseconds('0.00', 's')).toBe(0);      // a zero time penalty
    expect(() => toMicroseconds('-0.01', 's')).toThrow(/cannot be negative/);
  });

  it('derives honest decimal places from capture resolution', () => {
    expect(decimalsForResolution(1_000_000)).toBe(0); // whole seconds
    expect(decimalsForResolution(10_000)).toBe(2);    // hundredths
    expect(decimalsForResolution(1_000)).toBe(3);     // thousandths
  });

  it('refuses to display more precision than was captured', () => {
    // Hand timing to hundredths cannot be shown to three decimals.
    expect(() => formatTime(5_210_000, 3, 10_000)).toThrow(/exceeds the capture resolution/);
    expect(formatTime(5_210_000, 2, 10_000)).toBe('5.21 s');
  });
});
