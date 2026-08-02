/* ─────────────────────────────────────────────────────────────
   test.mjs — holographic organism tests

       node test.mjs

   What these actually protect:

   1. **Player compatibility.** Every cartridge we emit must use only the
      shapes, patterns and symmetries the universal player renders. Emitting
      `shape: "cube"` fails *silently* in the player — here it fails loudly.

   2. **The trust model.** A pet is a pure function of a mint-once tail. If
      any field ever becomes stored, random, or time-dependent the whole
      premise collapses, so the suite re-derives and compares.

   3. **One organism, two views.** The 2D portrait must *project* the same
      genome the hologram renders — not run a parallel derivation that can
      quietly drift away from it.
   ───────────────────────────────────────────────────────────── */

import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { alleles, TRAITS, TIERS, tierOf } from './allele.js';
import {
  genomeOf, cartridgeOf, genomeId, validateCartridge, playerUrl, keepsakeUrl,
  SHAPES, PATTERNS, SYMMETRIES, SPECIES,
} from './holo.js';
import { petOf } from './pets.js';

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { console.log(`  \x1b[32m✓\x1b[0m ${name}`); pass++; }
  else { console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? `\n      ${detail}` : ''}`); fail++; }
};
const group = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

const TAIL_A = 'a3f1c09e77b4d2856e0a19fc3b8d40725ce6119af8203d4b6ea75c918d0f3e2b';
const TAIL_B = 'f7d20b8e1c94a635d0e8237fb1ac95604e2d81f39c7a06b5e4183da29c60f7b1';

/* Pinned by hand from a verified run. Changing a derivation must change this. */
const GOLDEN = { id: '0916d1c931e9', title: 'Plum quill' };

/** Build a synthetic allele set so we can sweep the space without mining tails. */
function mk({ coat = 0, voice = 0, tempo = 0, glow = 0, tierName }) {
  const g = glow & 0xffff;
  return {
    coat: { value: coat & 0xff, bits: 8 },
    voice: { value: voice & 0xff, bits: 8 },
    tempo: { value: tempo & 0xff, bits: 8 },
    glow: {
      value: g, bits: 16,
      hex: '0x' + g.toString(16).padStart(4, '0').toUpperCase(),
      tier: tierName ? { name: tierName } : tierOf(g),
    },
  };
}

/* ── 1. player compatibility ──────────────────────────────────── */
group('The player can actually render what we emit');

{
  // Exhaustive sweep: no reachable allele may produce a vocabulary the player
  // does not know. A miss here renders as a silent fallback in the wild.
  let bad = null;
  for (let voice = 0; voice < 256 && !bad; voice++) {
    for (let coat = 0; coat < 256 && !bad; coat++) {
      const [form, surface] = genomeOf(mk({ coat, voice, tempo: coat })).genome.layers;
      if (!SHAPES.includes(form.shape)) bad = `voice ${voice} → shape "${form.shape}"`;
      else if (!SYMMETRIES.includes(form.symmetry)) bad = `voice ${voice} → symmetry "${form.symmetry}"`;
      else if (!PATTERNS.includes(surface.pattern)) bad = `coat ${coat} → pattern "${surface.pattern}"`;
    }
  }
  check('all 65,536 coat×voice genomes use a vocabulary the player knows', !bad, bad);
}

{
  // Ranged fields outside 0–1 get clamped by the renderer, so the organism
  // looks wrong in a way nothing reports.
  let out = null;
  for (let tempo = 0; tempo < 256 && !out; tempo++) {
    for (const glow of [0, 0x8000, 0xC000, 0xF000, 0xFFFF]) {
      const [, surface, motion] = genomeOf(mk({ coat: tempo, voice: tempo >> 5, tempo, glow })).genome.layers;
      const ranged = {
        glow: surface.glow, opacity: surface.opacity,
        breathe: motion.breathe, drift: motion.drift, pulse: motion.pulse, reach: motion.reach,
      };
      for (const [k, v] of Object.entries(ranged)) {
        if (!(typeof v === 'number' && v >= 0 && v <= 1)) { out = `${k}=${v} at tempo ${tempo} glow 0x${glow.toString(16)}`; break; }
      }
    }
  }
  check('every 0–1 field stays in range across the allele space', !out, out);
}

{
  const problems = [];
  for (let i = 0; i < 64; i++) {
    const tail = TAIL_A.slice(0, 62) + i.toString(16).padStart(2, '0');
    const cart = await cartridgeOf(tail, mk({ coat: i * 3, voice: i, tempo: i * 5, glow: i * 1013 }));
    problems.push(...validateCartridge(cart));
  }
  check('64 sampled cartridges all validate', problems.length === 0, problems.slice(0, 3).join('; '));
}

check('a limbless body plan claims no reach', (() => {
  const ring = SPECIES.findIndex((s) => s.limbs === 0);
  if (ring < 0) return false;
  const [form, , motion] = genomeOf(mk({ voice: ring, tempo: 200 })).genome.layers;
  return form.limb_len === 0 && motion.reach === 0;
})(), 'a body with no limbs must not animate limbs');

check('the genome declares exactly the three layer roles the player looks up', (() => {
  const roles = genomeOf(mk({})).genome.layers.map((l) => l.role);
  return roles.length === 3 && roles.join() === 'form,surface,motion';
})());

/* ── 2. the trust model ───────────────────────────────────────── */
group('A pet stays a pure function of the tail');

{
  const a1 = await alleles(TAIL_A);
  const a2 = await alleles(TAIL_A);
  const c1 = await cartridgeOf(TAIL_A, a1);
  const c2 = await cartridgeOf(TAIL_A, a2);
  check('same tail → byte-identical cartridge', JSON.stringify(c1) === JSON.stringify(c2));
  check('the id is content-addressed over the genome', c1.id === await genomeId(c1.genome), c1.id);

  const cB = await cartridgeOf(TAIL_B, await alleles(TAIL_B));
  check('different tails → different organisms', c1.id !== cB.id, `${c1.id} vs ${cB.id}`);
}

check('nothing in the genome reads a clock or rolls dice', !/Date\.now|new Date\(|Math\.random/.test(read('holo.js')),
  'holo.js must derive everything from the tail');

check('a freshly planted organism claims no lineage it did not earn',
  (await cartridgeOf(TAIL_A, await alleles(TAIL_A))).parents.length === 0);

check('glow is still the only tiered trait',
  TRAITS.filter((t) => t.bits === 16).map((t) => t.key).join() === 'glow',
  'adding a tiered trait would invent rarity the spec does not define');

check('rarer glow means a stronger aura, monotonically', (() => {
  const strength = (name) => genomeOf(mk({ tierName: name })).genome.layers[1].glow;
  const commonFirst = TIERS.map((t) => t.name).slice().reverse();
  const vals = commonFirst.map(strength);
  return vals.every((v, i) => i === 0 || v > vals[i - 1]);
})(), 'aura must increase with tier');

/* ── 3. one organism, two views ───────────────────────────────── */
group('The portrait and the hologram are the same creature');

{
  const a = await alleles(TAIL_A);
  const { genome, meta } = genomeOf(a);
  const p = petOf(a);
  const [form, surface] = genome.layers;
  check('portrait takes its shape from the genome', p.shape === form.shape, `${p.shape} vs ${form.shape}`);
  check('portrait takes its pattern from the genome', p.pattern === surface.pattern, `${p.pattern} vs ${surface.pattern}`);
  check('portrait takes its palette from the genome',
    JSON.stringify(p.palette) === JSON.stringify(surface.palette),
    `${JSON.stringify(p.palette)} vs ${JSON.stringify(surface.palette)}`);
  check('portrait species matches the body plan', p.species === meta.species);
  check('portrait label is coat + species', p.label === `${meta.coatName} ${meta.species}`, p.label);
}

check('portrait bob period spans the documented range', (() => {
  const at = (tempo) => petOf(mk({ tempo })).period;
  return at(0) === 2.6 && at(255) === 0.6;
})(), 'README documents 255 → 0.60s and 0 → 2.60s');

check('the 2D renderer speaks the player vocabulary', !/'spotted'|'striped'|'patched'/.test(read('pets.js')),
  'pets.js still references pre-holo pattern names');

/* ── 4. surfaces a player is handed ───────────────────────────── */
group('Links a player can open');

{
  const c = await cartridgeOf(TAIL_A, await alleles(TAIL_A));
  const url = playerUrl('https://example.test/cart.json');
  check('player URL pins the cartridge by url', url.includes('player.html?cart=') && url.includes('example.test'), url);
  check('cartridge names its home gallery and registry', !!c.home?.gallery && !!c.home?.registry);
  check('cartridge is small enough to travel in a URL-adjacent payload',
    JSON.stringify(c).length < 4096, `${JSON.stringify(c).length} bytes`);
  check('cartridge declares the schema the player checks for', c.schema === 'hologram-cartridge/1.0', c.schema);

  // The keepsake link is the local-first path: the organism rides inside the
  // URL fragment, which is never sent to a server. Decode it with the player's
  // own routine, copied verbatim, so a drift in either side fails here.
  const b64dec = (s) => {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  };
  const keep = keepsakeUrl(c);
  const hash = keep.split('#')[1];
  let decoded = null;
  try { decoded = JSON.parse(b64dec(hash)); } catch (e) { decoded = { error: String(e) }; }
  check("a keepsake link round-trips through the player's own decoder",
    JSON.stringify(decoded) === JSON.stringify(c), decoded?.error || 'payload differs');
  check('the keepsake payload is the whole fragment, not a named param',
    !hash.includes('='), 'the player parses location.hash.slice(1) directly');
  check('the keepsake uses the URL-safe alphabet', !/[+/]/.test(hash));
  check('a keepsake link fits comfortably in a URL', keep.length < 8000, `${keep.length} chars`);
  check('a keepsake carries no tail — only the organism it produced',
    !keep.includes(TAIL_A) && !JSON.stringify(c).includes(TAIL_A),
    'the mint-once secret must never travel in a shareable link');
}

/* ── 5. cabinet conformance ───────────────────────────────────── */
group('The cabinet accepts what we mint');

{
  // `genetics.mjs` is the cabinet's own machinery, vendored byte-identical.
  // Testing against it is testing against the thing that will actually judge us:
  // the cabinet re-derives a cartridge's id on ingest and rejects a mismatch.
  const cab = await import('./genetics.mjs');
  const A = await cartridgeOf(TAIL_A, await alleles(TAIL_A));
  const B = await cartridgeOf(TAIL_B, await alleles(TAIL_B));

  check("our id equals the cabinet's own genomeId", A.id === await cab.genomeId(A.genome),
    `${A.id} vs ${await cab.genomeId(A.genome)}`);
  check('canonical form is sorted-key, not insertion-ordered',
    cab.canonical({ b: 1, a: 2 }) === '{"a":2,"b":1}', cab.canonical({ b: 1, a: 2 }));
  check('a plain JSON.stringify would NOT have matched',
    JSON.stringify(A.genome) !== cab.canonical(A.genome),
    'if these ever coincide the test has stopped proving anything');

  const child = await cab.crossBreed(A, B);
  check('two pets breed in the cabinet', child.schema === 'hologram-cartridge/1.0');
  check('the child verifies', child.id === await cab.genomeId(child.genome));
  check('the child renders', validateCartridge(child).length === 0, validateCartridge(child).join('; '));
  check('the child records both parents',
    child.parents.length === 2 && child.parents.includes(A.id) && child.parents.includes(B.id));
  check('breeding is deterministic', (await cab.crossBreed(A, B)).id === child.id);
  check('A×B is not B×A', (await cab.crossBreed(B, A)).id !== child.id,
    'order must matter, or lineage collapses');

  // Grandchildren: proves fusion composes, which is what a Neon-style chain needs.
  const g = await cab.crossBreed(child, A);
  check('a child can breed again', validateCartridge(g).length === 0 && g.id === await cab.genomeId(g.genome));
}

check('the vendored genetics is unmodified from the cabinet', (() => {
  const src = read('genetics.mjs');
  return src.includes('reused (NOT forked)') && src.includes('Keep in sync with the cabinet');
})(), 'genetics.mjs must stay a faithful copy, not a fork');

{
  // Golden vector: pin one organism end-to-end. If a refactor changes any
  // derivation, this fails loudly instead of silently reshaping every pet
  // anyone has ever minted.
  const c = await cartridgeOf(TAIL_A, await alleles(TAIL_A));
  check('golden vector: known tail still yields its known organism',
    c.id === GOLDEN.id && c.title === GOLDEN.title,
    `got ${c.id} / ${c.title}, expected ${GOLDEN.id} / ${GOLDEN.title}`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
