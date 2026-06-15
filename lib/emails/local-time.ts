/**
 * Approximate local-time windows per country, so lifecycle emails land
 * mid-morning (~11 am) where the recipient lives instead of at midnight.
 *
 * Country-level UTC offsets are deliberately coarse (no DST, large
 * countries use a population-weighted pick) — being off by an hour is fine,
 * the goal is "morning, not 3 am".
 */

const COUNTRY_UTC_OFFSET: Record<string, number> = {
  // Americas
  US: -6, CA: -5, MX: -6, BR: -3, AR: -3, CL: -4, CO: -5, PE: -5, VE: -4,
  EC: -5, UY: -3, BO: -4, PY: -4, CR: -6, PA: -5, DO: -4, GT: -6,
  // Europe
  GB: 0, IE: 0, PT: 0, IS: 0, ES: 1, FR: 1, DE: 1, IT: 1, NL: 1, BE: 1,
  CH: 1, AT: 1, SE: 1, NO: 1, DK: 1, PL: 1, CZ: 1, SK: 1, HU: 1, HR: 1,
  SI: 1, RS: 1, BA: 1, AL: 1, MT: 1, LU: 1, RO: 2, BG: 2, GR: 2, FI: 2,
  EE: 2, LV: 2, LT: 2, UA: 2, MD: 2, CY: 2, BY: 3, RU: 3,
  // Middle East & Africa
  TR: 3, SA: 3, IQ: 3, KW: 3, QA: 3, BH: 3, OM: 4, AE: 4, IR: 3.5,
  IL: 2, JO: 3, LB: 2, EG: 2, MA: 1, DZ: 1, TN: 1, LY: 2, ZA: 2,
  NG: 1, GH: 0, KE: 3, ET: 3, TZ: 3, UG: 3, SN: 0, CI: 0, CM: 1,
  // Asia & Oceania
  IN: 5.5, PK: 5, BD: 6, LK: 5.5, NP: 5.75, MM: 6.5, TH: 7, VN: 7,
  KH: 7, LA: 7, ID: 7, MY: 8, SG: 8, PH: 8, BN: 8, CN: 8, HK: 8,
  MO: 8, TW: 8, MN: 8, KR: 9, JP: 9, AU: 10, NZ: 12, FJ: 12,
  KZ: 5, UZ: 5, AF: 4.5, GE: 4, AM: 4, AZ: 4,
};

/** Send window: 10:00–12:59 recipient-local (centered on ~11 am). */
const WINDOW_START = 10;
const WINDOW_END = 13;

export function utcOffsetForCountry(country: string | null | undefined): number {
  if (!country) return 0;
  return COUNTRY_UTC_OFFSET[country.toUpperCase()] ?? 0;
}

export function localHourFor(
  country: string | null | undefined,
  now: Date = new Date()
): number {
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  return (((utcHour + utcOffsetForCountry(country)) % 24) + 24) % 24;
}

/**
 * True when it's mid-morning for this recipient. Unknown countries fall
 * back to UTC, so they still get exactly one morning window per day.
 */
export function isWithinSendWindow(
  country: string | null | undefined,
  now: Date = new Date()
): boolean {
  const hour = localHourFor(country, now);
  return hour >= WINDOW_START && hour < WINDOW_END;
}

/**
 * Would the main daily "window" run (fired at `windowRunHourUTC` UTC) actually
 * reach this country — i.e. is it inside its 10:00–12:59 local window at that
 * UTC hour? On a once-a-day cron only a few UTC offsets line up; the rest are
 * served by a flat fallback run instead.
 */
export function isCoveredByWindowRun(
  country: string | null | undefined,
  windowRunHourUTC = 10
): boolean {
  const at = new Date();
  at.setUTCHours(windowRunHourUTC, 0, 0, 0);
  return isWithinSendWindow(country, at);
}
