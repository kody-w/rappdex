/* ─────────────────────────────────────────────────────────────
   allele.js — rapp-allele/1.0 derivation, verbatim from the spec.

   allele(trait, tail, bits) = int(sha256("rapp/1:allele:<trait>\n<tail>")[:bits/4], 16)

   Reference (kody-w/rapp-mapp ALLELE.md):
       import hashlib
       def allele(trait, tail, bits=16):
           h = hashlib.sha256(f"rapp/1:allele:{trait}\n{tail}".encode()).hexdigest()
           return int(h[:bits // 4], 16)

   Nothing here is stored or assigned. Every value is a pure function of a
   rappid tail, which RAPP/1 §6.2 mints exactly once and never re-rolls. That
   is the entire trust model: rarity is a property of the identity, not a
   claim about it, so anyone can verify it offline with no keys and no network.
   ───────────────────────────────────────────────────────────── */

/* The four traits. `bits` is how much of the hash the trait reads.
   Only `glow` is 16-bit, and only 16-bit values are tiered — the tier bands
   in the spec (0xC000 … 0xFFFF) are defined over 16 bits. coat/tempo/voice
   are 8-bit variety, not rarity: they colour the pet, they don't rank it. */
export const TRAITS = [
  { key: 'coat',  bits: 8,  blurb: 'how the organism presents' },
  { key: 'tempo', bits: 8,  blurb: 'how eagerly it acts' },
  { key: 'voice', bits: 8,  blurb: 'its register' },
  { key: 'glow',  bits: 16, blurb: 'the rare cosmetic' },
];

/* Exclusive bands, so the odds ARE the band widths. An earlier draft of the
   spec quoted cumulative odds against exclusive bands and disagreed with its
   own reference implementation; these are the corrected, measured values. */
export const TIERS = [
  { name: 'mythic',   min: 0xffff, max: 0xffff, odds: '1 in 65,536' },
  { name: 'ultra',    min: 0xff00, max: 0xfffe, odds: '~1 in 257'   },
  { name: 'rare',     min: 0xf000, max: 0xfeff, odds: '~1 in 17'    },
  { name: 'uncommon', min: 0xc000, max: 0xefff, odds: '~1 in 5'     },
  { name: 'common',   min: 0x0000, max: 0xbfff, odds: '3 in 4'      },
];

export function tierOf(value16) {
  return TIERS.find(t => value16 >= t.min && value16 <= t.max) || TIERS[TIERS.length - 1];
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** allele(trait, tail, bits) — matches the Python reference exactly. */
export async function allele(trait, tail, bits = 16) {
  const hex = await sha256Hex(`rapp/1:allele:${trait}\n${tail}`);
  return parseInt(hex.slice(0, bits / 4), 16);
}

/** Every trait for one tail, in spec order. */
export async function alleles(tail) {
  const out = {};
  for (const t of TRAITS) {
    const value = await allele(t.key, tail, t.bits);
    out[t.key] = {
      trait: t.key,
      bits: t.bits,
      value,
      hex: '0x' + value.toString(16).padStart(t.bits / 4, '0').toUpperCase(),
      blurb: t.blurb,
      // Only the 16-bit trait carries a tier. Saying an 8-bit value is
      // "mythic" would be inventing rarity the spec does not define.
      tier: t.bits === 16 ? tierOf(value) : null,
    };
  }
  return out;
}

/** A 64-hex tail, from real CSPRNG bytes — the same shape §6.2 mints. */
export function rollTail() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function isTail(s) {
  return /^[0-9a-f]{64}$/i.test((s || '').trim());
}
