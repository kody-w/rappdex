/* ─────────────────────────────────────────────────────────────
   pets.js — rapp-pets/0.2 · the 2D view of a holographic organism

   A pet is not a record, and it is no longer flat. Its body is a
   `hologram-cartridge/1.0` genome (see holo.js) that any hologram player
   can render in 3D. What lives here is the *portrait* — a fast 2D read of
   the same organism, drawn FROM that genome so the two can never disagree.

     genome  → the organism (holo.js, portable, player-agnostic)
     petOf   → the portrait  (this file, a projection of the genome)

   Its alleles remain a pure function of a mint-once rappid tail. So:

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

import { genomeOf } from './holo.js';

/* Colourways and species now live with the genome — one source of truth. */

/**
 * petOf(alleles) → the portrait of the organism.
 *
 * Every field is read from the genome rather than derived a second time.
 * That is the point: the 3D holo and this 2D portrait are one creature, so
 * a change to the body plan can never leave the two renderers disagreeing.
 */
export function petOf(alleles) {
  const { genome, meta } = genomeOf(alleles);
  const [form, surface, motion] = genome.layers;

  return {
    species: meta.species,
    coatName: meta.coatName,
    pattern: meta.pattern,
    body: meta.body,
    belly: meta.belly,
    earLift: meta.earLift,
    tailCurl: meta.tailCurl,
    // Eager organisms bob faster: 255 → 0.60s, 0 → 2.60s. Driven by the same
    // eagerness the motion layer uses, so portrait and hologram breathe together
    // — read from `meta` rather than the rounded layer value so the 2D period
    // keeps its full precision.
    period: Number((2.6 - meta.eagerness * 2.0).toFixed(2)),
    tier: meta.tier,
    glowHex: alleles.glow.hex,
    // The body plan, carried through so the portrait can hint at it.
    shape: form.shape,
    limbs: form.limbs,
    symmetry: form.symmetry,
    palette: surface.palette,
    label: `${meta.coatName} ${meta.species}`,
  };
}

function patternDefs(p, id, body, belly) {
  if (p === 'spot') {
    return `<pattern id="pat${id}" width="17" height="17" patternUnits="userSpaceOnUse">
      <rect width="17" height="17" fill="${body}"/>
      <circle cx="6" cy="6" r="3.1" fill="${belly}" opacity=".55"/>
      <circle cx="13" cy="13" r="2.1" fill="${belly}" opacity=".4"/></pattern>`;
  }
  if (p === 'stripe') {
    return `<pattern id="pat${id}" width="14" height="14" patternUnits="userSpaceOnUse"
              patternTransform="rotate(28)">
      <rect width="14" height="14" fill="${body}"/>
      <rect width="5" height="14" fill="${belly}" opacity=".38"/></pattern>`;
  }
  if (p === 'glow') {
    // The player's `glow` pattern is emissive; the portrait reads it as a
    // soft inner bloom so the same word means the same thing in both views.
    return `<radialGradient id="pat${id}">
      <stop offset="0%" stop-color="${belly}" stop-opacity=".95"/>
      <stop offset="62%" stop-color="${body}"/>
      <stop offset="100%" stop-color="${body}"/></radialGradient>`;
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
