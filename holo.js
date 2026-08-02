/* ─────────────────────────────────────────────────────────────
   holo.js — rapp-pets → hologram-cartridge/1.0

   A pet is a **digital holographic organism**, not a flat drawing.

   The organism's body is a `genome` in the shape the universal hologram
   player already speaks (`hologram-cartridge/1.0`), so a pet minted here
   renders in the Lantern, in the gallery, and in any other player that
   reads the format — with no per-creature code anywhere.

       https://kody-w.github.io/rapp-static-apis/hologram/

   The trust model is unchanged and non-negotiable: every field below is a
   pure function of the mint-once rappid tail, via the four spec alleles.
   Nothing is stored, nothing is assigned, nothing is re-rollable. Two
   people computing the same tail get byte-identical cartridges, forever.

   allele → genome layer:

       voice (8b)  → form     the body plan: shape, symmetry, limbs
       coat  (8b)  → surface  palette + pattern
       tempo (8b)  → motion   how eagerly it breathes, drifts, pulses
       glow  (16b) → surface.glow — the one tiered slot

   No new traits are invented. Inventing a trait would be inventing rarity
   the spec does not define, which is the exact failure rapp-pets exists to
   avoid.
   ───────────────────────────────────────────────────────────── */

/* The cabinet's breeding machinery, vendored byte-identical — see the note
   on the re-export below for why this must not be a second implementation. */
import { canonical, genomeId } from './genetics.mjs';

/* The player's own vocabularies. Emitting anything outside these renders as
   a silent fallback, so they are enumerated here rather than guessed. */
export const SHAPES = ['blob', 'star', 'ring', 'segment'];
export const PATTERNS = ['solid', 'spot', 'stripe', 'glow'];

/**
 * Per-role `k` values, matching the cabinet's own `momentToGenome`.
 *
 * The renderer never reads `k` — but it *is* part of the genome, so it is part
 * of the content hash. Using the cabinet's constants keeps our organisms in the
 * same id-space as everything else the cabinet mints, rather than in a private
 * dialect that merely happens to render.
 */
export const K = { form: 40, surface: 60, motion: 50 };
export const SYMMETRIES = ['bilateral', 'radial'];

/* 16 colourways. Body + belly, as before; the holo palette expands each into
   the four-stop ramp the surface shader samples. */
export const COATS = [
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

/* Eight species, each a distinct BODY PLAN rather than a sprite. The names
   are the ones rapp-pets already used, so an organism keeps its identity —
   it just stopped being flat. */
export const SPECIES = [
  { name: 'tuft',    shape: 'blob',    symmetry: 'bilateral', limbs: 4, segments: 8 },
  { name: 'lop',     shape: 'blob',    symmetry: 'bilateral', limbs: 5, segments: 7 },
  { name: 'quill',   shape: 'star',    symmetry: 'radial',    limbs: 7, segments: 5 },
  { name: 'moth',    shape: 'star',    symmetry: 'bilateral', limbs: 4, segments: 6 },
  { name: 'fen',     shape: 'segment', symmetry: 'bilateral', limbs: 6, segments: 9 },
  { name: 'crest',   shape: 'segment', symmetry: 'radial',    limbs: 3, segments: 7 },
  { name: 'nim',     shape: 'ring',    symmetry: 'radial',    limbs: 0, segments: 10 },
  { name: 'bramble', shape: 'star',    symmetry: 'radial',    limbs: 8, segments: 4 },
];

/* Aura strength per tier. `glow` is the only tiered slot, so it is the only
   thing here allowed to look rarer. */
const TIER_GLOW = { common: 0.10, uncommon: 0.24, rare: 0.46, ultra: 0.68, mythic: 0.92 };

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const round2 = (n) => Math.round(n * 100) / 100;

/* Lighten/darken a hex by a ratio, to build a 4-stop ramp from two tones.
   Deterministic and dependency-free. */
function shade(hex, ratio) {
  const n = parseInt(hex.slice(1), 16);
  const to = ratio > 0 ? 255 : 0;
  const t = Math.abs(ratio);
  const ch = (shift) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (to - c) * t).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * genomeOf(alleles) → the `genome` block of a hologram cartridge.
 *
 * Every value is a pure bit-read of the four spec alleles. The bit slices
 * match the ones rapp-pets already used, so an organism's species, coat and
 * tempo are the same creature they always were.
 */
export function genomeOf(alleles) {
  const coat = alleles.coat.value;    // 0–255
  const voice = alleles.voice.value;  // 0–255
  const tempo = alleles.tempo.value;  // 0–255
  const glow = alleles.glow;          // { value, tier, … }

  /* ── form ── the body plan, from `voice` ────────────────────── */
  const species = SPECIES[voice & 0x07];
  const earLift = (voice >> 3) & 0x03;   // 0–3  → how tall the body sits
  const tailCurl = (voice >> 5) & 0x07;  // 0–7  → how far the limbs reach

  const form = {
    role: 'form',
    k: K.form,
    shape: species.shape,
    limbs: species.limbs,
    segments: species.segments,
    symmetry: species.symmetry,
    body_r: round2(0.18 + earLift * 0.035),   // 0.18–0.29
    limb_len: species.limbs === 0 ? 0 : round2(0.22 + tailCurl * 0.055), // 0.22–0.61
  };

  /* ── surface ── colourway + pattern, from `coat`; aura from `glow` ── */
  const [body, belly, coatName] = COATS[coat & 0x0f];
  const pattern = PATTERNS[(coat >> 4) & 0x03];
  const tier = glow.tier ? glow.tier.name : 'common';

  const surface = {
    role: 'surface',
    k: K.surface,
    palette: [body, shade(body, 0.22), belly, shade(body, -0.35)],
    pattern,
    glow: TIER_GLOW[tier] ?? 0.1,
    opacity: round2(0.86 + ((coat >> 6) & 0x03) * 0.035), // 0.86–0.97
  };

  /* ── motion ── from `tempo`. Eager organisms breathe and pulse harder. ── */
  const eagerness = tempo / 255;
  const motion = {
    role: 'motion',
    k: K.motion,
    breathe: round2(0.04 + eagerness * 0.16),
    drift: round2(((tempo >> 2) & 0x0f) / 15 * 0.5),
    pulse: round2(0.15 + eagerness * 0.6),
    // A limbless organism has nothing to reach with.
    reach: species.limbs === 0 ? 0 : round2(0.2 + ((tempo >> 5) & 0x07) / 7 * 0.6),
  };

  return {
    genome: { layers: [form, surface, motion], compose: { windows: [[0, 1, 2]], loop: true } },
    // Read-through conveniences so the 2D renderer and the UI can describe the
    // SAME organism without re-deriving anything.
    meta: { species: species.name, coatName, pattern, tier, body, belly, earLift, tailCurl, eagerness },
  };
}

/**
 * cartridgeOf(tail, alleles, opts) → a complete `hologram-cartridge/1.0`.
 *
 * `id` is content-addressed over the genome, exactly like the registry's
 * `versions/<name>/<sha8>.json` pins — so the same organism always has the
 * same cartridge id, and a changed genome is a different cartridge.
 */
export async function cartridgeOf(tail, alleles, opts = {}) {
  const { genome, meta } = genomeOf(alleles);
  const title = opts.title || `${meta.coatName} ${meta.species}`;

  const cart = {
    schema: 'hologram-cartridge/1.0',
    id: await genomeId(genome),
    title: title.charAt(0).toUpperCase() + title.slice(1),
    author: opts.author || '@rapp-pets',
    born: {
      // The tail IS the birth coordinate — mint-once, so this can never move.
      coord: tail ? `${tail.slice(0, 8)},${tail.slice(-8)}` : '0,0',
      from: opts.from || 'allele',
    },
    // An organism planted from another is a fresh mint with a fresh tail, so
    // lineage is never numeric inheritance — it only ever records provenance.
    parents: opts.parents || [],
    genome,
    sig: '',
    home: {
      name: opts.homeName || 'the RAPPdex',
      gallery: 'https://kody-w.github.io/rapp-static-apis/hologram/index.html',
      registry: 'https://kody-w.github.io/rapp-static-apis/hologram/registry.json',
    },
  };

  return cart;
}

/** Stable sha8 over the canonical genome — the cartridge's content address. */
/**
 * Canonical stringify and the content-addressed id.
 *
 * These are not reimplemented here — they come from the cabinet's own
 * `genetics.mjs`, vendored byte-identical. That matters because the cabinet
 * re-derives a cartridge's id when it ingests one and rejects any that
 * disagrees: a second implementation that merely *looked* equivalent would send
 * every organism we mint back as unverified. One implementation, no drift.
 *
 * (`canonical` is sorted-key and stable; a plain `JSON.stringify` is
 * insertion-ordered and would hash differently.)
 */
export { canonical, genomeId };
/** Where the universal player lives. */
const PLAYER = 'https://kody-w.github.io/rapp-static-apis/hologram/player.html';

/** Point the player at a cartridge that is already hosted somewhere. */
export function playerUrl(cartUrl) {
  return `${PLAYER}?cart=${encodeURIComponent(cartUrl)}`;
}

/**
 * A whole organism encoded into a link, with nothing uploaded anywhere.
 *
 * The player reads its entire URL fragment as base64 JSON:
 *
 *     if (hash) { try { cart = JSON.parse(b64dec(hash)); } catch {} }
 *
 * and `b64dec` un-swaps the URL-safe alphabet before decoding. A fragment is
 * never transmitted to a server, so this is the local-first way to hand a pet
 * to the player: the organism travels inside the link itself, and the registry
 * never learns it exists.
 */
export function keepsakeUrl(cart) {
  const json = JSON.stringify(cart);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${PLAYER}#${b64}`;
}

/**
 * Validate a cartridge against what the player actually renders.
 * Returns [] when clean. Used by the tests and by the UI's export path, so a
 * malformed organism can never be handed to a player.
 */
export function validateCartridge(cart) {
  const problems = [];
  if (!cart || typeof cart !== 'object') return ['not an object'];
  if (cart.schema !== 'hologram-cartridge/1.0') problems.push(`schema is ${cart.schema}`);
  if (!/^[0-9a-f]{12}$/.test(cart.id || '')) problems.push('id is not a 12-hex content address');
  if (!cart.title) problems.push('missing title');
  if (!Array.isArray(cart.parents)) problems.push('parents must be an array');

  const layers = cart.genome?.layers;
  if (!Array.isArray(layers) || layers.length !== 3) {
    problems.push('genome.layers must hold form, surface and motion');
    return problems;
  }

  const byRole = Object.fromEntries(layers.map((l) => [l.role, l]));
  for (const role of ['form', 'surface', 'motion']) {
    if (!byRole[role]) problems.push(`missing ${role} layer`);
  }

  const { form, surface, motion } = byRole;
  if (form) {
    if (!SHAPES.includes(form.shape)) problems.push(`shape "${form.shape}" is not one the player renders`);
    if (!SYMMETRIES.includes(form.symmetry)) problems.push(`symmetry "${form.symmetry}" is unknown`);
    if (!(form.segments > 0)) problems.push('segments must be positive');
    if (form.limbs > 0 && !(form.limb_len > 0)) problems.push('limbed organism has no limb length');
  }
  if (surface) {
    if (!PATTERNS.includes(surface.pattern)) problems.push(`pattern "${surface.pattern}" is not one the player renders`);
    if (!Array.isArray(surface.palette) || surface.palette.length < 2) problems.push('palette needs at least two stops');
    else if (!surface.palette.every((c) => /^#[0-9a-fA-F]{6}$/.test(c))) problems.push('palette holds a non-hex colour');
    for (const key of ['glow', 'opacity']) {
      if (typeof surface[key] !== 'number' || surface[key] < 0 || surface[key] > 1) problems.push(`surface.${key} out of 0–1`);
    }
  }
  if (motion) {
    for (const key of ['breathe', 'drift', 'pulse', 'reach']) {
      if (typeof motion[key] !== 'number' || motion[key] < 0 || motion[key] > 1) problems.push(`motion.${key} out of 0–1`);
    }
  }

  const windows = cart.genome?.compose?.windows;
  if (!Array.isArray(windows) || !windows.length) problems.push('compose.windows is empty');

  return problems;
}
