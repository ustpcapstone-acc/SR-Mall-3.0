/**
 * Inappropriate-language detection for Customer Experiences comments.
 *
 * The list intentionally focuses on clearly abusive / profane words (English
 * and Filipino) instead of generic words that would cause false positives.
 * Matching is normalized so simple leetspeak, accents, punctuation and
 * repeated letters do not bypass it.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  // English profanity / abuse
  /\b(?:fuck|fucks|fucked|fucker|fuckers|fucking|motherfucker|motherfuckers|motherfucking)\b/,
  /\b(?:shit|shits|shitty|shitting|shitted)\b/,
  /\b(?:bitch|bitches|bitchy|bitching|bitched)\b/,
  /\b(?:asshole|assholes|arsehole|arseholes)\b/,
  /\b(?:bastard|bastards)\b/,
  /\b(?:cunt|cunts)\b/,
  /\b(?:dick|dicks|dickhead|dickheads)\b/,
  /\b(?:cock|cocks|cockhead|cockheads)\b/,
  /\b(?:pussy|pussies)\b/,
  /\b(?:whore|whores)\b/,
  /\b(?:slut|sluts)\b/,
  /\b(?:nigger|niggers|nigga|niggas)\b/,
  /\b(?:faggot|faggots)\b/,
  /\b(?:retard|retards|retarded)\b/,
  /\b(?:rape|raped|raping|rapist|rapists)\b/,
  /\bkys\b/,
  // Filipino profanity / insults
  /\bputa(?:ng)?\b/,
  /\bputang[\s-]*ina\b/,
  /\bputangina\b/,
  /\bputa[\s-]*ina\b/,
  /\btang(?:ina|inamo|inang)\b/,
  /\bkingina(?:ng)?\b/,
  /\bpunyeta(?:ng)?\b/,
  /\bgago(?:ng)?\b/,
  /\bgaga(?:ng)?\b/,
  /\bbobo(?:ng)?\b/,
  /\btanga(?:ng)?\b/,
  /\bulol\b/,
  /\bulul\b/,
  /\btarantad[oa]\b/,
  /\bhinayupak\b/,
  /\blintik\b/,
  /\bpakyu\b/,
  /\bkupal\b/,
  /\bhayop[\s-]+ka\b/,
  // Severe words written with separators, e.g. f.u.c.k / f u c k
  /\bf[\W_]*u[\W_]*c[\W_]*k(?:er|ers|ing|ed|s)?\b/,
  /\bs[\W_]*h[\W_]*i[\W_]*t(?:ty|ting|ted|s)?\b/,
  /\bb[\W_]*i[\W_]*t[\W_]*c[\W_]*h(?:es|y|ing|ed|s)?\b/,
];

function normalize(text: string, leetPunctuation: boolean) {
  let value = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Common leetspeak substitutions.
    .replace(/[@]/g, "a")
    .replace(/\$/g, "s")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t");

  // "sh!t" uses ! as an i; a normal "shit!" must still match, so both
  // variants are checked below.
  if (leetPunctuation) value = value.replace(/[!|]/g, "i");

  return value
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the matched expression when inappropriate language is found,
 * otherwise null. The match is for server-side logging only — never show the
 * raw matched word back to the reviewer.
 */
export function findInappropriateLanguage(text?: string | null): string | null {
  if (!text) return null;

  const variants = [normalize(text, false), normalize(text, true)]
    .filter(Boolean)
    // Collapse long runs such as "fuuuck" / "puuuta" without changing normal
    // two-letter pairs (so "ass" stays "ass").
    .flatMap((value) => [value, value.replace(/(.)\1{2,}/g, "$1")]);

  for (const variant of variants) {
    for (const pattern of BLOCKED_PATTERNS) {
      const match = variant.match(pattern);
      if (match) return match[0].trim();
    }
  }

  return null;
}
