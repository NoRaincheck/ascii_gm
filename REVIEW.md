# Review

## What landed

Wall/stair redesign in `lib/game.ts` with matching tests in `tests/game.test.ts`:

- **Rounded terraces** — each level's bounding box has corners scooped by a deterministic quarter-circle arc (`cornerRadius` + `inRoundedRect`): radius 2 for spans >= 10, radius 1 for spans 7-9, square for spans < 7. The coastlines read as curves, and the same seed always reproduces the same shape.
- **Wall bands hug the rounded lid** — the cliff face of each band is carved to the upper level's rounded bottom row, so walls recede where the terrace curves away and never float over open sea.
- **One 1-wide stair per overlapping room pair** — painter's order: all cliff faces first, then exactly one width-1 stair door per overlap, stamped on top. Doors are ranked in tiers (both flanks walled-in > one flank > any wall above land), then placed by backtracking so doors keep at least one wall column between them.
- **Deterministic rounding, random doors** — re-seeding changes which walls carry doors; the roundness of the coastline is a pure function of span width.
- Tests: room-fill allows rounded corners; bands-hug-lid + one-door-per-pair; no 2x2 wall/stair blocks; stairs never flush; terrace corners rounded quarter-circles (wide levels arc by 2 tiles on every corner); reachability flood now seeds from the first walkable tile.
- `deno fmt` clean; `deno lint` clean on `lib/game.ts` (test file has a pre-existing `no-import-prefix` note on the std import).
- Full suite: **38 passed / 0 failed** (verified after fmt and the final edit).

## Open questions

1. **Sea-flanked doors at rounded corners.** When a corner scoop leaves only one wall column for a pair's door, the door is placed with open sea on one side (it keeps at least one cliff flank — the test asserts `left === 'cliff' || right === 'cliff'`). Is that acceptable, or should a door walled-in on only one flank stay sealed?

2. **Doorless pinches.** Two neighbouring overlaps can each have exactly one usable column, side by side — backtracking then leaves the second one doorless (their rooms link through level-mates). The "one door per pair" test deliberately tolerates a missing door only when no un-pinched column survives. Is that permissiveness right?

3. **Roundedness of wide levels.** Wide terraces round with a 2-tile arc (R=2). If the curve reads too subtle on screen, bump wide levels to R=3 and update the arc assertions.

4. **Fully scooped-out overlap stays sealed.** A pair whose overlap lies entirely inside a corner scoop keeps its wall (no door) — its rooms must be reached via level-mates. On a narrow map this could in principle strand a pair; the flood test (30 seeds over two sizes) has not found one yet. Worth a dedicated test for the pathological narrow case?

5. **Docs card.** AGENTS.md requires the single latest card in `docs/`. No docs change was made here (only `lib/`, `tests/`, `REVIEW.md`). Should a new card documenting the rounded-terrace / width-1-door layout be generated?