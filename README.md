# rappdex

A pocket index of the RAPP ecosystem. Installable, works offline, and derives
**alleles** and **pets** on-device.

**→ https://kody-w.github.io/rappdex/**

Add it to your Home Screen and it behaves like an app: the map is vendored, the
service worker precaches the shell, and every allele is computed locally with
`crypto.subtle`. No account, no server, no network required after first load.

## What it is

Three views:

| view          | what it does                                                                     |
| ------------- | -------------------------------------------------------------------------------- |
| **Dex**       | Every surface in the ecosystem, numbered, searchable, filterable by layer        |
| **Pets**      | Paste or plant a rappid tail → its four alleles, drawn as a pet                  |
| **The words** | The Lexicon rules and the authority note, straight from the map                  |

## It is built entirely off rapp-mapp

There is no database here and no hand-maintained list. Every entry comes from
[`kody-w/rapp-mapp`](https://github.com/kody-w/rapp-mapp)'s `mapp.json`:

1. fetch `mapp.json` live from `raw.githubusercontent.com` on open, so the dex
   tracks the map;
2. fall back to the vendored snapshot in this repo when offline.

The header always says which one you are looking at. If the map gains a
surface, the dex gains an entry — no change here required.

> The map is a **map**, not a registry. It confers no trust and establishes no
> owner acceptance. Protocol authority is [rapp-1](https://github.com/kody-w/rapp-1);
> governance authority is [RAPP/CONSTITUTION.md](https://github.com/kody-w/RAPP).

## Pets, and why they can't be faked

A pet is **not a record**. It is the rendering of an organism's alleles, and an
allele is a pure function of the rappid tail — which RAPP/1 §6.2 mints exactly
once and never re-rolls.

```
allele(trait, tail, bits) = int(sha256("rapp/1:allele:<trait>\n<tail>")[:bits/4], 16)
```

So the same tail produces the same pet on every machine, forever, and nobody —
including the owner — can re-roll it, edit it, or assert it. That inverts Adopt
Me's trust model (where a server owns your pet) while keeping the mechanic that
makes it work: you didn't choose it, it's yours specifically, and anyone can
verify it offline with a hash and no keys.

| trait   | bits | drives                     |
| ------- | ---- | -------------------------- |
| `coat`  | 8    | colourway + pattern        |
| `tempo` | 8    | how fast it bobs           |
| `voice` | 8    | species silhouette         |
| `glow`  | 16   | the aura — the tiered slot |

**Only `glow` is tiered**, because the spec's bands (`0xC000`…`0xFFFF`) are
defined over 16 bits. `coat`, `tempo` and `voice` are 8-bit *variety* — they
colour the pet, they don't rank it. Calling an 8-bit value "mythic" would be
inventing rarity the spec doesn't define.

Bands are **exclusive**, so the odds are the band widths:

| tier     | band            | odds         |
| -------- | --------------- | ------------ |
| common   | `< 0xC000`      | 3 in 4       |
| uncommon | `0xC000–0xEFFF` | ~1 in 5      |
| rare     | `0xF000–0xFEFF` | ~1 in 17     |
| ultra    | `0xFF00–0xFFFE` | ~1 in 257    |
| mythic   | `0xFFFF`        | 1 in 65,536  |

### What it is not

- **Not a token.** No transfer, no balance, no price. An allele is a property of
  an identity, and identity is mint-once — there is nothing to detach and sell.
- **Not a gate.** An allele never affects what an organism may *do*. Capability
  comes from the mandate (Art. LVI). A mythic coat buys you a mythic coat.
- **Not private.** Alleles are computed from the public tail — pure DOG,
  bones-side by construction, nothing to leak.
- **No fusion.** The Neon mechanic needs §10 signatures and estate-owner
  authority, so it is specified upstream but **not implemented**. Shipping it
  before signing exists would be a false-authority defect.

## Verify it yourself

`allele.js` is the reference implementation, line for line:

```python
import hashlib
def allele(trait, tail, bits=16):
    h = hashlib.sha256(f"rapp/1:allele:{trait}\n{tail}".encode()).hexdigest()
    return int(h[:bits // 4], 16)
```

Checked against this page: identical outputs for the all-zero tail, the all-`f`
tail, and random tails. Over 20,000 mints the tier split lands at
75.0 / 18.7 / 5.9 / 0.35 / 0 — matching the spec's measured column.

## Files

```
index.html   three views
app.js       data loading, dex rendering, pet wiring
allele.js    rapp-allele/1.0 derivation (portable, no DOM)
pets.js      deterministic SVG pet renderer (portable, no DOM)
mapp.json    vendored snapshot — the offline floor
sw.js        precaches the shell; never caches the live map
```

`allele.js` and `pets.js` have no DOM dependencies, so
[`rapp-pets`](https://github.com/kody-w/rapp-pets) uses the same two files —
the two apps cannot drift.

## Licence

MIT.
