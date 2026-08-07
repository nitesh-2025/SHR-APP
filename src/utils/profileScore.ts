/**
 * How a profile-completeness score is coloured and worded.
 *
 * The score itself is server-computed (`profile_score`, 0–100) — it counts the
 * same fields HR counts, which is why nothing here recomputes it from the form.
 * This module only decides how to SAY it.
 *
 * The bands are traffic-light on purpose: a single brand-green bar told you the
 * number but not whether the number was a problem. Red is "HR is missing things
 * they need", amber is "nearly there", green is "nothing blocking".
 */

import { danger, success, surface, warning, type Surface } from '../theme/colors';

export type ScoreBand = 'low' | 'mid' | 'high';

/** Below this the record is treated as incomplete enough to flag red. */
export const BAND_MID = 50;
/** At or above this it is green. Between the two it is amber. */
export const BAND_HIGH = 75;

export function bandOf(score: number): ScoreBand {
  if (score < BAND_MID) return 'low';
  if (score < BAND_HIGH) return 'mid';
  return 'high';
}

/**
 * The bar / ink colour for a score. Deliberately the semantic **500** step
 * rather than the 600: 500 is the one rung of each ramp that clears contrast on
 * both the white canvas and the dark one, so the bar does not need a second
 * value per scheme.
 */
export function scoreColor(score: number): string {
  const band = bandOf(score);
  if (band === 'low') return danger[500];
  if (band === 'mid') return warning[500];
  return success[500];
}

/** The tinted-surface recipe matching the band — pass through `toneFor` for dark. */
export function scoreSurface(score: number): Surface {
  const band = bandOf(score);
  if (band === 'low') return surface.danger;
  if (band === 'mid') return surface.warning;
  return surface.success;
}

/**
 * One line naming what the number means. A bare percentage invites "so what?" —
 * these say who is waiting and for what.
 */
export function scoreLabel(score: number): string {
  if (score >= 100) return 'Your profile is complete';
  const band = bandOf(score);
  if (band === 'low') return 'Your profile needs attention';
  if (band === 'mid') return 'Almost there';
  return 'Nearly complete';
}
