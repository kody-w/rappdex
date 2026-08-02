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

   WHAT THIS HONESTLY CANNOT DO

   It proves the parents *existed*. It does not prove they were consumed. With
   no ledger there is no way to burn anything, so the same four tails can be
   fused again, and the identical child comes out. That is a real limitation
   and it is stated rather than papered over: fusion is proof of accumulated
   minting, not proof of sacrifice.
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
