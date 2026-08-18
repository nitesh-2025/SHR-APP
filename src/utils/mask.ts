/**
 * Sensitive-data masking.
 *
 * Two jobs, one house style.
 *
 * `maskTail` is for a FIELD — a value already known to be a PAN, an account
 * number, a phone. `maskSensitive` is for PROSE that somebody typed, where the
 * sensitive value has to be recognised before it can be hidden: ticket bodies,
 * replies and regularization reasons are typed by people, and people paste
 * whatever the problem is about — a salary account, an Aadhaar, the OTP that
 * never arrived. That text then sits in a list any colleague can shoulder-surf,
 * and in a screenshot the moment somebody shares the ticket.
 *
 * ── The house style ──────────────────────────────────────────────────────
 * `XXXXXX9518`. Not bullets, not asterisks, and not a run of X the length of
 * the original.
 *
 *   - **X, not `•`** — a bullet run reads as a loading state or a password
 *     field; X reads as "this was deliberately covered". It also survives being
 *     read aloud, copied into a chat, and typed back by hand.
 *   - **The last four stay** — that is the whole point. "Is this the right
 *     account" is the only question these screens exist to answer, and four
 *     digits answer it. Hiding everything answers nothing and just makes the
 *     row useless.
 *   - **A fixed-length mask** — six X regardless of how long the value was.
 *     A mask that tracks the real length leaks the length, and a 16-digit card
 *     rendered as twelve X and four digits wraps the line on a phone.
 *
 * Masking is presentation only. Nothing is deleted, nothing is sent anywhere
 * different, and both `MaskedValue` and `MaskedText` let the reader reveal a
 * value deliberately — because the owner of an account number has to be able to
 * check it, and a mask you cannot lift is just data loss.
 */

const X = 'X';

/** Fixed-width cover. See "the house style" above — length is not a clue. */
const COVER = X.repeat(6);

/** Digits only, so a spaced or dashed value masks the same as a plain one. */
const digitsOf = (s: string) => s.replace(/\D/g, '');

/**
 * `123456789518` → `XXXXXX9518`.
 *
 * Values of four characters or fewer are returned untouched: there is nothing
 * left to hide once the tail is kept, and `XXXXXX18` on a two-digit value would
 * invent a secret that was never there.
 */
export function maskTail(value?: string | null, keep = 4): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (v.length <= keep) return v;
  return `${COVER}${v.slice(-keep)}`;
}

/** Same, but reads the digits out of a formatted value first. */
function maskDigitTail(raw: string, keep = 4): string {
  const d = digitsOf(raw);
  if (d.length <= keep) return raw;
  return `${COVER}${d.slice(-keep)}`;
}

export interface MaskResult {
  /** Masked text, safe to render. */
  text: string;
  /** Something was actually hidden — drives the reveal affordance. */
  masked: boolean;
  /** How many values were hidden. Spoken in the accessibility label. */
  count: number;
}

type Rule = { re: RegExp; to: (m: string, ...rest: string[]) => string };

/**
 * Recognise, then blunt. None of these are anchored to a label ("a/c no:",
 * "aadhaar:") on purpose — the whole point is the value that was pasted without
 * one.
 *
 * Ordering is not cosmetic. Each rule replaces digits with X, so a wider
 * pattern that runs first eats the narrower one's input: a 16-digit card must
 * be tried before a 12-digit Aadhaar, and both before a bare 10-digit mobile.
 */
const RULES: Rule[] = [
  // Email — the domain stays, because "which mailbox" is usually the question
  // and the local part is the identifying half. Unlike every other rule there
  // is no tail to keep: the last four letters of a name are not a checksum
  // anybody verifies, and `XXXXXX@gmail.com` already says what it needs to.
  {
    re: /\b[A-Za-z0-9][A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    to: (_m, domain) => `${COVER}${domain}`,
  },

  // Card — 13 to 19 digits in the usual 4-group shape.
  {
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    to: (m) => (digitsOf(m).length >= 13 ? maskDigitTail(m) : m),
  },

  // Aadhaar — three groups of four, WRITTEN as groups. The separator is
  // required: a bare 12-digit run is just as likely to be a bank account, and
  // it falls through to the account rule below, which masks it identically.
  {
    re: /\b\d{4}[ -]\d{4}[ -]\d{4}\b/g,
    to: (m) => maskDigitTail(m),
  },

  // Indian mobile, with or without the country code, and with or without the
  // 5+5 space people type by habit — `98765 43210` is how a number gets pasted
  // out of a contact card, and a rule that only saw `9876543210` missed the
  // most common form of the most common secret in a ticket.
  {
    re: /(?:\+?91[ -]?)?\b[6-9]\d{4}[ -]?\d{5}\b/g,
    to: (m) => maskDigitTail(m),
  },

  // Bank account — any remaining run of 9 to 18 digits. Deliberately above a
  // 4-digit floor so years, PIN codes, amounts and ticket numbers are left
  // alone; a masked "2026" would be noise, not privacy.
  {
    re: /\b\d{9,18}\b/g,
    to: (m) => maskDigitTail(m),
  },

  // PAN — five letters, four digits, one letter.
  {
    re: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    to: (m) => maskTail(m),
  },

  // IFSC — same treatment as everything else. The bank prefix used to be
  // kept, which was a nice touch and an inconsistency: one field masked to a
  // different shape than its five neighbours reads as a bug in the masking,
  // not as a considered exception.
  {
    re: /\b([A-Z]{4})0[A-Z0-9]{6}\b/g,
    to: (m) => maskTail(m),
  },

  // OTP / PIN / CVV quoted next to its label. Short digit runs are invisible to
  // every rule above, and this is the one place where 3-6 digits are a secret.
  // Nothing is kept here — there is no "confirm the right OTP" question, so a
  // tail would be a leak with no use behind it.
  {
    re: /\b(otp|pin|cvv|password|passcode)\b([^\dA-Za-z\n]{0,12})(\d{3,8})\b/gi,
    to: (_m, label, gap) => `${label}${gap}${COVER}`,
  },
];

/**
 * Mask every sensitive-looking value in a block of text.
 *
 * Returns the original untouched when nothing matched, so callers can skip the
 * reveal affordance rather than offering to "show" text that was never hidden.
 */
export function maskSensitive(input?: string | null): MaskResult {
  const source = input ?? '';
  if (!source) return { text: '', masked: false, count: 0 };

  let out = source;
  let count = 0;

  for (const rule of RULES) {
    out = out.replace(rule.re, (...args) => {
      const m = String(args[0]);
      const groups = args.slice(1, -2).map((g) => String(g ?? ''));
      const replaced = rule.to(m, ...groups);
      if (replaced !== m) count += 1;
      return replaced;
    });
  }

  return { text: out, masked: count > 0, count };
}

/**
 * A stored phone number, masked for display.
 *
 * Separate from `maskSensitive` because this one runs on a FIELD, not on prose:
 * the value is already known to be a phone number, so there is no pattern to
 * recognise and no risk of a false positive.
 */
export function maskPhone(phone?: string | null): string {
  const d = digitsOf(phone ?? '');
  if (!d) return phone ?? '';
  return maskDigitTail(d);
}
