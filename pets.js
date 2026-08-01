/* ─────────────────────────────────────────────────────────────
   pets.js — rapp-pets/0.1

   A pet is not a record. It is the *rendering* of an organism's alleles,
   and its alleles are a pure function of a mint-once rappid tail. So:

     same tail  →  same pet, on every machine, forever
     no server  →  nothing to trust, nothing to re-roll
     no storage →  there is no "pet row" anyone could edit

   That inverts Adopt Me's trust model while keeping the mechanic that makes
   it work: you did not choose it, it is yours specifically, and everyone can
   verify what you got.

   Trait → anatomy:
     coat  (8b)  colourway + pattern      — how it presents
     voice (8b)  species silhouette       — its register
     tempo (8b)  idle animation speed     — how eagerly it acts
     glow  (16b) aura, the tiered slot    — the rare cosmetic

   Only `glow` is tiered, because only 16-bit values have bands in the spec.
   ───────────────────────────────────────────────────────────── */

/* 16 colourways. Two tones each: body, and the belly/ear inner. */
const COATS = [
  ['#CC785C', '#F2D9CE', 'ember'],
  ['#8C6A4F', '#E8D6C3', 'loam'],
  ['#5B7B6E', '#D6E3DC', 'fern'],
  ['#41607F', '#D2DFEA', 'tide'],
  ['#7A5C86', '#E2D6E8', 'plum'],
  ['#B0483F', '#F0D2CE', 'rust'],
  ['#C9A227', '#F3E7BE', 'honey'],
  ['#3F5D4A', '#D3E0D6', 'moss'],
  ['#6E6A66', '#E1DEDA', 'ash'],
  ['#2E3A46', '#CFD8E0', 'slate'],
  ['#A8763F', '#F0DDC2', 'amber'],
  ['#57493F', '#DFD4C8', 'bark'],
  ['#7E8C4B', '#E6EBCF', 'sage'],
  ['#9B5A7A', '#EBD5E0', 'thistle'],
  ['#3C7071', '#D0E4E4', 'lagoon'],
  ['#141413', '#CFCECB', 'ink'],
];

const PATTERNS = ['solid', 'spotted', 'striped', 'patched'];
const SPECIES = ['tuft', 'lop', 'quill', 'moth', 'fen', 'crest', 'nim', 'bramble'];

/** Decompose the four allele values into pet anatomy. All pure bit reads. */
export function petOf(alleles) {
  const coat = alleles.coat.value;      // 0–255
  const voice = alleles.voice.value;    // 0–255
  const tempo = alleles.tempo.value;    // 0–255
  const glow = alleles.glow;            // {value, tier, …}

  const coatIdx = coat & 0x0f;
  const pattern = PATTERNS[(coat >> 4) & 0x03];
  const speciesIdx = voice & 0x07;
  const earLift = ((voice >> 3) & 0x03);      // 0–3
  const tailCurl = ((voice >> 5) & 0x07);     // 0–7

  // Eager pets bob faster. 255 → 0.60s, 0 → 2.60s.
  const period = (2.6 - (tempo / 255) * 2.0).toFixed(2);

  const [body, belly, coatName] = COATS[coatIdx];

  return {
    species: SPECIES[speciesIdx],
    coatName, pattern, body, belly,
    earLift, tailCurl,
    period: Number(period),
    tier: glow.tier ? glow.tier.name : 'common',
    glowHex: glow.hex,
    // "an ember tuft, striped, with a rare aura"
    label: `${coatName} ${SPECIES[speciesIdx]}`,
  };
}

function patternDefs(p, id, body, belly) {
  if (p === 'spotted') {
    return `<pattern id="pat${id}" width="17" height="17" patternUnits="userSpaceOnUse">
      <rect width="17" height="17" fill="${body}"/>
      <circle cx="6" cy="6" r="3.1" fill="${belly}" opacity=".55"/>
      <circle cx="13" cy="13" r="2.1" fill="${belly}" opacity=".4"/></pattern>`;
  }
  if (p === 'striped') {
    return `<pattern id="pat${id}" width="14" height="14" patternUnits="userSpaceOnUse"
              patternTransform="rotate(28)">
      <rect width="14" height="14" fill="${body}"/>
      <rect width="5" height="14" fill="${belly}" opacity=".38"/></pattern>`;
  }
  if (p === 'patched') {
    return `<pattern id="pat${id}" width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="30" height="30" fill="${body}"/>
      <path d="M0 0 h16 q5 8 -3 15 q-9 5 -13 -2 Z" fill="${belly}" opacity=".5"/>
      <path d="M30 30 h-13 q-4 -7 3 -12 q8 -4 10 3 Z" fill="${belly}" opacity=".42"/></pattern>`;
  }
  return `<pattern id="pat${id}" width="1" height="1"><rect width="1" height="1" fill="${body}"/></pattern>`;
}

function auraFor(tier, id, body) {
  switch (tier) {
    case 'uncommon':
      return `<circle cx="100" cy="104" r="74" fill="none" stroke="${body}" stroke-opacity=".22" stroke-width="2"/>`;
    case 'rare':
      return `<circle cx="100" cy="104" r="76" fill="none" stroke="#CC785C" stroke-opacity=".75" stroke-width="2.5"/>
              <circle cx="100" cy="104" r="84" fill="none" stroke="#CC785C" stroke-opacity=".25" stroke-width="1.5"/>`;
    case 'ultra':
      return `<circle cx="100" cy="104" r="76" fill="none" stroke="#141413" stroke-width="3"/>
              <circle cx="100" cy="104" r="85" fill="none" stroke="#CC785C" stroke-width="2.5"/>
              <circle cx="100" cy="104" r="93" fill="none" stroke="#141413" stroke-opacity=".28" stroke-width="1.5"/>`;
    case 'mythic':
      return `<g class="rp-halo" style="transform-origin:100px 104px">
                <circle cx="100" cy="104" r="88" fill="none" stroke="#CC785C" stroke-width="3"
                        stroke-dasharray="5 9" stroke-linecap="round"/>
              </g>
              <circle cx="100" cy="104" r="76" fill="none" stroke="#141413" stroke-width="3"/>
              <circle cx="100" cy="104" r="70" fill="url(#myth${id})" opacity=".30"/>`;
    default:
      return '';
  }
}

/**
 * renderPet(alleles, {id, size}) → SVG markup string.
 * `id` must be unique per pet on a page (defs are namespaced by it).
 */
export function renderPet(alleles, opts = {}) {
  const id = opts.id || 'p';
  const size = opts.size || 200;
  const p = petOf(alleles);

  // Ears lift with `earLift`; tail curls with `tailCurl`. Both pure.
  const ear = 18 + p.earLift * 9;
  const curl = -14 + p.tailCurl * 7;

  const mythDef = p.tier === 'mythic'
    ? `<radialGradient id="myth${id}"><stop offset="0%" stop-color="#CC785C" stop-opacity=".9"/>
         <stop offset="100%" stop-color="#CC785C" stop-opacity="0"/></radialGradient>` : '';

  return `
<svg class="rp" viewBox="0 0 200 200" width="${size}" height="${size}"
     role="img" aria-label="${p.label}, ${p.pattern}, ${p.tier} aura"
     style="--rp-period:${p.period}s">
  <defs>
    ${patternDefs(p.pattern, id, p.body, p.belly)}
    ${mythDef}
  </defs>

  ${auraFor(p.tier, id, p.body)}

  <g class="rp-bob">
    <!-- tail -->
    <path d="M146 128 q26 ${curl} 20 -26" fill="none" stroke="${p.body}"
          stroke-width="11" stroke-linecap="round"/>
    <!-- ears -->
    <path d="M74 78 L66 ${78 - ear} L88 68 Z" fill="${p.body}"/>
    <path d="M126 78 L134 ${78 - ear} L112 68 Z" fill="${p.body}"/>
    <path d="M76 77 L71 ${79 - ear * 0.62} L86 71 Z" fill="${p.belly}" opacity=".85"/>
    <path d="M124 77 L129 ${79 - ear * 0.62} L114 71 Z" fill="${p.belly}" opacity=".85"/>
    <!-- body -->
    <ellipse cx="100" cy="126" rx="46" ry="40" fill="url(#pat${id})"/>
    <ellipse cx="100" cy="136" rx="27" ry="24" fill="${p.belly}" opacity=".92"/>
    <!-- head -->
    <circle cx="100" cy="88" r="34" fill="url(#pat${id})"/>
    <ellipse cx="100" cy="98" rx="19" ry="15" fill="${p.belly}" opacity=".92"/>
    <!-- face -->
    <circle class="rp-eye" cx="89" cy="85" r="4.4" fill="#141413"/>
    <circle class="rp-eye" cx="111" cy="85" r="4.4" fill="#141413"/>
    <circle cx="90.6" cy="83.4" r="1.5" fill="#FAF9F5"/>
    <circle cx="112.6" cy="83.4" r="1.5" fill="#FAF9F5"/>
    <path d="M100 94 l-4.5 4 h9 Z" fill="#141413" opacity=".82"/>
    <!-- feet -->
    <ellipse cx="80" cy="162" rx="12" ry="7" fill="${p.body}"/>
    <ellipse cx="120" cy="162" rx="12" ry="7" fill="${p.body}"/>
  </g>
</svg>`.trim();
}

export const PET_CSS = `
.rp{display:block}
.rp .rp-bob{animation:rp-bob var(--rp-period,1.6s) ease-in-out infinite;transform-origin:100px 140px}
.rp .rp-eye{animation:rp-blink calc(var(--rp-period,1.6s) * 4) steps(1,end) infinite}
.rp .rp-halo{animation:rp-spin 9s linear infinite}
@keyframes rp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes rp-blink{0%,96%{transform:scaleY(1)}97%,99%{transform:scaleY(.12)}100%{transform:scaleY(1)}}
@keyframes rp-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){
  .rp .rp-bob,.rp .rp-eye,.rp .rp-halo{animation:none}
}`;
