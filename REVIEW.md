# ASCII Art Implementation Review

## Summary

Added composable ASCII art generation to the card system. Art is based on card field values (action, detail, topic, objective, job, adversaries) and is displayed:
- **CLI**: Side-by-side with the card, 4-char gap, art in muted overlay0 color
- **PNG**: As a subtle background behind the card text (alpha=80)

## Files Changed/Created

### New Files
- `lib/art/` - Directory containing 10 art piece files
- `lib/art/mod.ts` - Re-exports all art pieces
- `lib/art/action_scene.ts` - Combat/action scene art
- `lib/art/castle.ts` - Castle/fortress art
- `lib/art/danger.ts` - Skull/danger art
- `lib/art/figure.ts` - Standing person art
- `lib/art/forest.ts` - Forest/trees art
- `lib/art/mountain.ts` - Mountain/cliff art
- `lib/art/ruins.ts` - Broken walls art
- `lib/art/symbolic.ts` - Star/symbol art
- `lib/art/village.ts` - Village/houses art
- `lib/art/water.ts` - Waves/water art
- `lib/art.ts` - Compositing logic, field mapping, generateArt()

### Modified Files
- `lib/spritesheet.ts` - Expanded CHAR_MAP for full CP437 glyphs, added art background rendering
- `lib/card.ts` - Added generateArt import/export
- `lib/terminal.ts` - Added side-by-side card + art output
- `cli.ts` - Wired art generation into pipeline
- `lib/mod.ts` - Exported generateArt

## Architecture

### Art Piece Format
Each art piece is exactly 22 chars wide × 18 lines tall (matching card dimensions). Uses CP437 box drawing characters, block elements, and symbols for visual variety.

### Field-to-Art Mapping
- `action` → action_scene (combat words), symbolic (investigation/mystery words)
- `detail` → forest, mountain, water, village, ruins, castle (location keywords)
- `topic` → symbolic (positive themes), danger (negative themes)
- `objective` → castle (defense/protect), village (escort/rescue), symbolic (knowledge), ruins (restore/fix)
- `job` → figure (most jobs), symbolic (mages/scholars), village (merchants/farmers)
- `adversaries` → danger (enemies/monsters), castle (guardians), village (locals)

### Compositing Priority
Art pieces are layered in this order (lower priority drawn first):
1. water
2. forest
3. mountain
4. ruins
5. village
6. castle
7. action_scene
8. symbolic
9. figure
10. danger

### CLI Output
```
┌────────────────────┐    (art displayed here)
│...card content...  │    with 4-char gap
└────────────────────┘
```

### PNG Output
1. Render art background with reduced opacity (alpha=80)
2. Render card text on top with full opacity

## Known Issues / Notes

### Art Piece Dimensions
All art pieces verified to be exactly 22×18 characters. The compositing function pads/truncates as needed.

### Character Set
Expanded CHAR_MAP in spritesheet.ts to support full CP437 character set including:
- Box drawing (single, double, mixed lines)
- Block elements (shading, full blocks)
- Shapes and symbols (arrows, suits, math operators)

### Future Enhancements
- Add more art pieces for better coverage of field values
- Consider adding animation/transitions for CLI output
- Could add user-configurable art themes
- Art pieces could be loaded from external files for easier customization
