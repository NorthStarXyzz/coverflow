# Verification — 0.1.0

Checked 2026-10-05 (Asia/Shanghai).

- Library and demo TypeScript checks passed.
- 16 contract tests passed: 3D geometry, spring stability, unique IDs, empty collections, reorder/removal, repeated covers, a 5,000-item bounded render window, controlled playback, callback errors, artwork-only reflections, unsafe text/URL handling, idle/disposal, reduced motion and pointer capture transfer/reconciliation.
- All 12 original SVG files passed structure, local-reference, size and hash validation.
- Offline installation of the generated .tgz succeeded in a fresh consumer directory; ESM import is SSR-safe and the CSS subpath export resolves.
- ESM/declarations/CSS package and static Vite demo built successfully. The demo uses external SVG file URLs, not blocked inline data URLs.
- In-app Chromium browser acceptance: all six covers decoded at 1000px, left/right keyboard selection, Home boundary/disabled previous control, Enter activation, play/pause labels, real mouse drag with a rapid left flick selecting a later cover, reflection toggle and Reduce Motion toggle.
- Dark and light presentations inspected. Narrow layout inspected with actual 341px document width, with no document horizontal overflow; temporary viewport override reset afterwards.
- Main selected-cover controls are exposed as native buttons. Reflections have no interactive content. Side artwork is shaded rather than transparent, preserving clear overlap.
- Native Cider/Spotify resources, music-service APIs, credentials, real album media, songs and lyrics are absent from the component and demo. No claim of platform endorsement or guaranteed universal legal clearance is made.

The demo’s playback is simulated UI state. Browser acceptance does not imply a media-service integration has been tested. Renderer frame counts describe this component; no overall power-consumption improvement is claimed.
