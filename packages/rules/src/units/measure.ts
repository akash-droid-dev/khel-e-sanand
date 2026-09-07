/**
 * Exact measurement handling.
 *
 * §6: "Decimal measurements use exact decimal or integer base units, not binary
 * floating-point equality."
 * §14: "Unit-bearing measurements carry raw value, normalised value, unit and precision."
 *
 * This matters concretely. In IEEE-754 doubles, 1.005 * 1000 === 1004.9999999999999,
 * so a naive metre→millimetre conversion of a 1.005 m jump truncates to 1004 mm — a
 * silent millimetre that can reorder a podium. Everything here therefore parses the
 * DECIMAL STRING and shifts the point by integer arithmetic. No float multiplication
 * ever touches a stored mark, so GT-026 ("132 cm and 1.32 m are the same 1320 mm")
 * holds by construction rather than by luck.
 */

export const DISTANCE_UNITS = ['m', 'cm', 'mm'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const TIME_UNITS = ['s', 'ms', 'us'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

/** Decimal places between each unit and its integer base unit. */
const DISTANCE_SHIFT: Record<DistanceUnit, number> = { m: 3, cm: 1, mm: 0 };
const TIME_SHIFT: Record<TimeUnit, number> = { s: 6, ms: 3, us: 0 };

export class MeasurementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeasurementError';
  }
}

const DECIMAL_RE = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * Shift a decimal string left by `places` and return an exact integer.
 * "1.32" shifted 3 → 1320.  "132" shifted 1 → 1320.  "5.21" shifted 6 → 5210000.
 *
 * Throws if the value carries more precision than the shift can hold, rather than
 * rounding silently — §6 forbids inventing accuracy the instrument did not capture.
 */
export function shiftDecimalToInteger(raw: string, places: number): number {
  const text = raw.trim();
  const m = DECIMAL_RE.exec(text);
  if (!m) throw new MeasurementError(`Not a decimal number: "${raw}"`);

  const negative = m[1] === '-';
  const whole = m[2] ?? '0';
  const frac = m[3] ?? '';

  if (frac.length > places) {
    throw new MeasurementError(
      `Value "${raw}" has ${frac.length} decimal places but the unit holds ${places}. ` +
        `Record the measurement in its captured unit instead of rounding here.`,
    );
  }

  const padded = frac.padEnd(places, '0');
  const digits = `${whole}${padded}`.replace(/^0+(?=\d)/, '');
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) throw new MeasurementError(`Value out of safe range: "${raw}"`);
  return negative ? -n : n;
}

/** Render an integer base-unit value back to a decimal string with `places` decimals. */
export function formatFromInteger(value: number, places: number): string {
  const negative = value < 0;
  const digits = String(Math.abs(value)).padStart(places + 1, '0');
  const cut = digits.length - places;
  const whole = digits.slice(0, cut);
  const frac = digits.slice(cut);
  const body = places > 0 ? `${whole}.${frac}` : whole;
  return negative ? `-${body}` : body;
}

/* ------------------------------------------------------------------ *
 * Distance — normalised to integer millimetres
 * ------------------------------------------------------------------ */

/** Parse a measured distance to exact millimetres. GT-026 depends on this. */
export function toMillimetres(raw: string | number, unit: DistanceUnit): number {
  const text = typeof raw === 'number' ? String(raw) : raw;
  const mm = shiftDecimalToInteger(text, DISTANCE_SHIFT[unit]);
  if (mm < 0) throw new MeasurementError(`A distance cannot be negative: ${raw} ${unit}`);
  return mm;
}

/** Render millimetres for display. `unit` selects the reader-facing unit. */
export function formatDistance(mm: number, unit: DistanceUnit = 'm'): string {
  return `${formatFromInteger(mm, DISTANCE_SHIFT[unit])} ${unit}`;
}

/* ------------------------------------------------------------------ *
 * Time — normalised to integer microseconds
 * ------------------------------------------------------------------ */

/**
 * Parse a recorded time value to exact microseconds.
 *
 * Accepts zero, because this parses an INSTANT on the event timing reference
 * (a start gun at t=0, a lap crossing) or a non-negative quantity such as an
 * approved time penalty. Durations have a stricter rule — see
 * `toDurationMicroseconds`.
 */
export function toMicroseconds(raw: string | number, unit: TimeUnit): number {
  const text = typeof raw === 'number' ? String(raw) : raw;
  const us = shiftDecimalToInteger(text, TIME_SHIFT[unit]);
  if (us < 0) {
    throw new MeasurementError(`A recorded time cannot be negative: ${raw} ${unit}`);
  }
  return us;
}

/**
 * Parse an elapsed DURATION. Strictly positive.
 * §17: "A completed run cannot have zero/negative duration." A sprint recorded as
 * 0.00 s is a data-entry failure, not a very fast athlete.
 */
export function toDurationMicroseconds(raw: string | number, unit: TimeUnit): number {
  const us = toMicroseconds(raw, unit);
  if (us === 0) {
    throw new MeasurementError(`A completed run cannot have a zero or negative time: ${raw} ${unit}`);
  }
  return us;
}

/**
 * Render microseconds at the profile's display precision.
 *
 * `displayDecimals` must not exceed what the timing device actually captured —
 * the caller passes `capture_resolution_us` and this refuses to fabricate accuracy
 * beyond it (§17: "Must not invent greater accuracy than capture").
 */
export function formatTime(
  us: number,
  displayDecimals: number,
  captureResolutionUs: number,
): string {
  const resolutionDecimals = decimalsForResolution(captureResolutionUs);
  if (displayDecimals > resolutionDecimals) {
    throw new MeasurementError(
      `Display precision of ${displayDecimals} decimals exceeds the capture resolution ` +
        `of ${captureResolutionUs} µs (${resolutionDecimals} decimals).`,
    );
  }
  const divisor = 10 ** (6 - displayDecimals);
  // Round half-up at the display boundary only. The stored value is untouched.
  const scaled = Math.round(us / divisor);
  return `${formatFromInteger(scaled, displayDecimals)} s`;
}

/** How many decimal seconds a capture resolution in microseconds can honestly support. */
export function decimalsForResolution(captureResolutionUs: number): number {
  if (captureResolutionUs <= 0) throw new MeasurementError('Capture resolution must be positive.');
  let decimals = 0;
  let step = 1_000_000;
  while (step > captureResolutionUs && decimals < 6) {
    step /= 10;
    decimals += 1;
  }
  return decimals;
}

/**
 * Two timing values are comparable only when captured by the same method at a
 * compatible resolution. §17 requires that a conflict between official finish order
 * and timing opens a review case rather than being resolved silently — this predicate
 * is what lets the sprint calculator detect "not comparable" instead of guessing.
 */
export function timesAreComparable(
  a: { timing_method: string; capture_resolution_us: number },
  b: { timing_method: string; capture_resolution_us: number },
): boolean {
  return a.timing_method === b.timing_method && a.capture_resolution_us === b.capture_resolution_us;
}
