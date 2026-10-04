# API

Import `Coverflow` from the package and import `@northstarxyzz/coverflow/style.css` once. Module imports are SSR-safe; constructing an instance requires a browser document.

## Items

`{ id, title, subtitle?, artwork?, accent? }`

IDs are unique, non-empty strings identifying **occurrences**. Two occurrences may share an artwork URL, but not an ID. Titles are non-empty strings and rendered as text. `artwork` can be an HTTP(S), blob or relative image URL; PNG/JPEG/GIF/WebP/AVIF data URLs are also supported. Script/document schemes and inline SVG data URLs are rejected. Serve SVG files by URL (in Vite use `?no-inline` when needed). `accent` is an optional hexadecimal placeholder color.

Items are shallow-copied on input. Duplicate/invalid IDs are rejected before changing a live list. An empty list renders “No covers yet”. Failed images keep a project-owned geometric placeholder; the library does not try external fallback providers. Image requests suppress the referrer; the browser still loads the host’s provided URLs. The host is responsible for their privacy and usage rights.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| items | required | Initial collection |
| selectedId | first item | Initial selection; an unknown initial ID uses the first item |
| playback | `{ id: null, isPlaying: false }` | Host playback state |
| label | Cover carousel | Accessible region name |
| reflection | true | Artwork-only reflection |
| reducedMotion | undefined | Follow OS preference; an explicit boolean overrides spring motion |
| maxCardSize | 390 | Maximum artwork size in CSS pixels; must be finite and >=80 |
| onSelect | none | `(item, index, reason)`; reason is pointer/wheel/keyboard/api/items |
| onAction | none | `(item, 'play' \| 'pause')`; may return a promise |
| onError | none | Callback errors; otherwise a `coverflowerror` CustomEvent is dispatched on the component element |

## Methods

- `select(id, animate = true)`: select an existing ID; unknown IDs throw.
- `next()` / `previous()`: bounded navigation; no looping.
- `setItems(items)`: preserve selected and visible anchor identities across reorder. Removal chooses the nearest remaining index. Empty lists clear cards and captions. Invalid input does not partially mutate the collection.
- `setPlayback({ id, isPlaying })`: update the host’s playback status; does not automatically move selection.
- `setReflection(boolean)`: toggle artwork-only reflections.
- `setReducedMotion(boolean | undefined)`: choose an override or follow the OS.
- `dispose()`: idempotent; remove the owned DOM, listeners, observer, pointer capture and animation. Other mutating methods then throw.

`state` exposes selected ID/index, copied playback state, item count, continuous position, animation status and live-card count. `diagnostics` reports renderer frames and live cards, not media-service or listening analytics.

## Interaction

Click a side cover to select it; click the settled selected cover or press Enter/Space to activate it. Actions are omitted when no `onAction` is provided. Buttons are native controls; focus and press feedback are visible. Use Left/Right, Home/End, pointer dragging or a wheel to navigate. Pinch/zoom wheel gestures are left to the browser.

Selection is separate from playback. The component never starts media or sets playing optimistically. The host should call `setPlayback` after confirming its action. If an asynchronous host operation fails, `onError` receives the failure. Hosts with overlapping requests should reconcile their own actual playback state instead of assuming callback completion order.

Pointer dragging interrupts a spring. Newer navigation interrupts prior intent. Large jumps (>15 positions) snap to avoid loading a long intermediate sequence. The spring schedules no frames after settling and pauses while the document is hidden. At most 15 card DOM nodes/images are retained around the current position, independent of collection size.

For framework wrappers, construct after mount, update item/playback properties, and dispose during unmount. Do not recreate the whole component for a playback-only update.
