/* ─────────────────────────────────────────────────────────────
   fuse.js — the fusion law.

       fuse(tails) = sha256("rapp/1:fuse\n" + sorted(tails).join("\n"))

   Four organisms become one. The child is not a new *kind* of thing: the
   result is an ordinary 64-hex tail, so the child's alleles come out of the
   ordinary derivation in `allele.js`, with the ordinary odds. Nothing here
   invents a trait, uplifts a tier, or hands out rarity.

   WHY THIS EXISTS

   Adopt Me's actual engine is not its gacha and not its care loop — it is the
   fusion sink. Four full-grown pets make a Neon; four Neons make a Mega, so a
   Mega costs sixteen pets. That single rule does something no drop-table can:
   it makes a *duplicate* valuable. Without it, most pulls are boring and get
   discarded. With it, every boring pull is an ingredient.

   That is exactly the problem this project has. Minting identities produces
   mostly common organisms — 3 in 4 by the spec's own bands. Fusion is what
   makes those commons worth keeping.

   WHY IT DOESN'T BREAK THE TRUST MODEL

   You cannot produce a well-formed child without knowing four real tails. A
   tail is minted exactly once and never re-rolled, so a child is unforgeable
   evidence that four identities were actually minted. That is the same kind of
   scarcity the glow bands have — real work, not an assertion — which is why
   this can be added without inventing anything:

     · The child's rarity is not a *tier*. Tiers stay exactly as the spec
       defines them, over 16 bits, uninflated. Fusing four mythics does not
       produce something better than mythic.
     · The child's rarity is its *generation* — and generation is arithmetic.
       Gen 1 costs 4 minted identities, gen 2 costs 16, gen 3 costs 64. Depth
       is the scarce axis, and it is honest by construction.
     · Anyone holding the four parents can recompute the child and check it.
       Offline, no keys, no network — the same standard as every other claim
       this project makes.

   WHAT THIS CAN AND CANNOT DO

   It proves the four parents existed. On the question of whether they were
   *spent*, the honest split is finer than "no ledger, no burn":

     · On this device, the burn is ENFORCED. Each parent emits a nullifier —
       a spend-marker only its holder can produce — and the registry refuses a
       parent it has already seen consumed.
     · Across devices, the burn is DETECTED, not prevented. Because a
       nullifier is identical every time it is produced, spending one organism
       into two children publishes the same value twice. Anyone holding both
       children holds a proof of the double-spend. No authority adjudicates it;
       the collision is the adjudication.
     · What genuinely needs an authority is ORDERING — deciding which of two
       conflicting fusions came first. That needs a clock somebody agrees on.
       So equivocation is caught, but not arbitrated, and this code says so
       rather than pretending to a verdict it cannot reach.

   That is the same posture Certificate Transparency takes: you do not prevent
   the lie, you make it undeniable.
   ───────────────────────────────────────────────────────────── */

import { isTail } from './allele.js';

/** How many organisms a fusion consumes. Four, for the same reason Adopt Me
    chose four: it is small enough to reach and large enough to hurt. */
export const FUSE_ARITY = 4;

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The nullifier — the thing that makes a burn real without a ledger.
 *
 *     nullifier(tail) = sha256("rapp/1:nullifier\n" + tail)
 *
 * A spend-marker with exactly the properties needed and no more:
 *
 *   · Only the holder can produce it. The tail is a mint-once secret, so
 *     nobody can mark an organism spent on its owner's behalf.
 *   · It reveals nothing. Preimage resistance means seeing a nullifier tells
 *     you nothing about which organism it belongs to — unless you already know
 *     that organism's tail, in which case you can check.
 *   · It is the SAME every time. This is the whole trick, and it is why the
 *     nullifier is deliberately NOT bound to the child: if it were, the same
 *     parent could be spent into two different children under two different
 *     markers and the burn would be theatre. Unbound, spending a parent twice
 *     emits the identical value twice — and that collision is the evidence.
 *
 * So a child publishes the nullifiers of its parents. Anyone holding two
 * children that share a nullifier holds a proof that one organism was spent
 * twice. No authority adjudicates it; the collision *is* the adjudication.
 *
 * This is the same construction Zcash uses to retire a note, and the same
 * posture Certificate Transparency takes toward bad certificates: you do not
 * prevent the lie, you make it undeniable.
 */
export async function nullifierOf(tail) {
  const t = String(tail || '').trim().toLowerCase();
  if (!isTail(t)) throw new Error('a nullifier needs a 64-hex tail');
  return sha256Hex('rapp/1:nullifier\n' + t);
}

/** The nullifiers a fusion of these parents burns, in sorted order. */
export async function nullifiersFor(tails) {
  const ns = await Promise.all((tails || []).map(nullifierOf));
  return ns.sort();
}

/**
 * Fuse four tails into the child's tail.
 *
 * Sorted, so fusion is a property of the *set* — the order you happen to place
 * them in is not a secret and must not change the outcome. Distinct, because
 * fusing an organism with itself would let one identity stand in for four and
 * make the whole cost fictional.
 */
export async function fuse(tails) {
  const clean = (tails || []).map((t) => String(t || '').trim().toLowerCase());

  if (clean.length !== FUSE_ARITY) {
    throw new Error(`fusion takes exactly ${FUSE_ARITY} organisms, got ${clean.length}`);
  }
  const bad = clean.find((t) => !isTail(t));
  if (bad !== undefined) throw new Error('every parent must be a 64-hex tail');
  if (new Set(clean).size !== clean.length) {
    throw new Error('the four parents must be four different organisms');
  }

  return sha256Hex('rapp/1:fuse\n' + clean.slice().sort().join('\n'));
}

/**
 * What a fusion would cost, in identities minted from scratch.
 *
 * Generation 1 is four. Every generation after that is four of the previous,
 * so the cost is 4^n — the same shape as Adopt Me's 4 → 16, carried as far as
 * anyone cares to take it.
 */
export function costOfGeneration(gen) {
  return FUSE_ARITY ** Math.max(0, gen);
}

/**
 * Verify a claimed descent. Returns true only if these four parents really do
 * produce this child.
 *
 * This is the whole point: a generation claim is checkable by anyone, offline,
 * without trusting whoever is making it.
 */
export async function verifyDescent(childTail, parentTails) {
  try {
    return (await fuse(parentTails)) === String(childTail || '').trim().toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Detect a double-spend across any set of fusions, offline, with no authority.
 *
 * A fusion record is `{ child, spent }` — the child's tail (or id) and the
 * sorted nullifiers it burned. Two records sharing a nullifier mean one
 * organism was spent twice, and the two records together are the whole proof.
 * Anyone can run this. Nobody has to be trusted to run it.
 *
 * Returns `[]` when clean, otherwise one entry per conflicting nullifier.
 */
export function detectDoubleSpend(records) {
  const seen = new Map();
  const conflicts = new Map();

  for (const rec of records || []) {
    for (const n of rec.spent || []) {
      const prior = seen.get(n);
      if (prior && prior.child !== rec.child) {
        const bucket = conflicts.get(n) || new Set([prior.child]);
        bucket.add(rec.child);
        conflicts.set(n, bucket);
      } else if (!prior) {
        seen.set(n, rec);
      }
    }
  }

  return [...conflicts.entries()].map(([nullifier, children]) => ({
    nullifier,
    children: [...children],
    // Deliberately no verdict on which came first. Ordering needs a clock
    // somebody agrees on, and that is the authority we don't have. Detection
    // is total; arbitration is not, and pretending otherwise would be the
    // same overclaim this design exists to avoid.
    proof: 'these fusions burned the same organism',
  }));
}

/**
 * A spend registry — the local half of the burn.
 *
 * Detection across devices is a social act: it needs someone to hold both
 * records. On your own device there is no such gap, so here the burn is simply
 * *enforced* — a parent that has been spent cannot be spent again, and the
 * registry says so before the fusion happens rather than after.
 *
 * Storage is injected so this works against localStorage, a file, or nothing
 * at all in a test.
 */
export function spendRegistry(store = new Map()) {
  const get = (k) => (store.get ? store.get(k) : store[k]);
  const set = (k, v) => (store.set ? store.set(k, v) : (store[k] = v));

  return {
    /** Has this organism already been burned? */
    isSpent(nullifier) {
      return Boolean(get(nullifier));
    },
    /** Which of these parents are already spent? */
    spentAmong(nullifiers) {
      return (nullifiers || []).filter((n) => Boolean(get(n)));
    },
    /** Record a burn. Returns false if it was already spent — never silently
        overwrites, because a silent overwrite is how a burn becomes theatre. */
    burn(nullifier, childTail) {
      if (get(nullifier)) return false;
      set(nullifier, childTail);
      return true;
    },
    /** The full record, for export or gossip. */
    records() {
      const out = [];
      const entries = store.entries ? [...store.entries()] : Object.entries(store);
      for (const [nullifier, child] of entries) out.push({ nullifier, child });
      return out;
    },
  };
}

/**
 * Fuse, and actually burn the parents.
 *
 * This is the honest fusion: it refuses to re-spend an organism the registry
 * has already seen consumed, and it returns the nullifiers so the child can
 * carry its own proof of what it cost.
 */
export async function fuseAndBurn(tails, registry) {
  const nullifiers = await nullifiersFor(tails);
  const already = registry.spentAmong(nullifiers);
  if (already.length) {
    throw new Error(
      `${already.length} of these organisms ${already.length === 1 ? 'has' : 'have'} already been spent`
    );
  }

  const child = await fuse(tails);   // validates arity, hex, distinctness
  for (const n of nullifiers) registry.burn(n, child);
  return { child, spent: nullifiers };
}
