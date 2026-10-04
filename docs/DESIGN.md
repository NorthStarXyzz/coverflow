# Design review

The component and demo apply the **apple-design** skill’s public HIG references as design principles for the web, with an independent implementation and assets.

- `layout.md › Visual hierarchy`: artwork is the primary content; controls are grouped below it, with a quieter title/subtitle hierarchy and no enclosing decorative panel.
- `materials.md › Liquid Glass`: restrained translucency is limited to interactive controls. Artwork remains opaque; side covers are shaded instead of becoming transparent and revealing unrelated covers behind them.
- `buttons.md › Best practices`: controls have 44–46 CSS-pixel interaction regions, focus-visible outlines, hover/press feedback and native disabled semantics. CSS pixels are a web design choice, not a claim of native UIKit point equivalence.
- `icons.md › Best practices`: a consistent 24px canvas, round stroke language and optical balancing. Original geometry, no SF Symbols or extracted client glyphs.
- `typography.md › Ensuring legibility`: system font stack, regular/medium weights, restrained sizes and readable title/subtitle contrast; no bundled commercial font files.
- `color.md › Best practices` and `accessibility.md › Vision`: light/dark appearances, non-color state distinctions and increased-contrast adaptations.
- `motion.md › Best practices`: motion responds to gestures, stays interruptible, settles, respects Reduce Motion and avoids ambient idle animation.
- `designing-for-macos.md` and `cross-platform.md`: keyboard and pointer operation, responsive narrow layouts and explicit focus feedback rather than hover-only actions.

These are HIG-informed web conventions, not Apple certification. The design uses original abstract vector studies and describes a carousel component, without representing a proprietary music-client screen or claiming a pixel-perfect commercial UI clone.
