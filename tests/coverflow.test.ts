import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Coverflow, coverPose, advanceSpring, type CoverflowItem } from '../src/index.js';
const { JSDOM } = createRequire(import.meta.url)('jsdom');
const items = (count = 6): CoverflowItem[] => Array.from({ length: count }, (_, index) => ({ id: `cover-${index}`, title: `Study ${index}`, subtitle: 'Original', artwork: '/test-cover.svg' }));
function fixture(reduced = false) {
  const dom = new JSDOM('<!doctype html><main id="mount"></main>', { url: 'http://localhost/', pretendToBeVisual: true }), win = dom.window;
  let reducedMotion = reduced, requests = 0, callbacks = new Map<number, FrameRequestCallback>(), id = 0, time = 0;
  win.matchMedia = () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} });
  win.requestAnimationFrame = (callback: FrameRequestCallback) => { requests++; callbacks.set(++id, callback); return id; };
  win.cancelAnimationFrame = (key: number) => callbacks.delete(key);
  Object.defineProperty(globalThis, 'AbortController', { value: win.AbortController, configurable: true });
  Object.defineProperty(globalThis, 'ResizeObserver', { value: class { observe() {} disconnect() {} }, configurable: true });
  const mount = win.document.getElementById('mount')!;
  return { dom, win, mount, get requests() { return requests; }, get pending() { return callbacks.size; }, frame(ms = 1000 / 60) { time += ms; const batch = [...callbacks.values()]; callbacks.clear(); for (const callback of batch) callback(time); }, finish() { for (let i = 0; i < 500 && callbacks.size; i++) this.frame(); }, key(key: string) { const root = mount.querySelector('.cf-viewport')!; root.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); }, close() { dom.window.close(); } };
}
test('3D pose is symmetric, turns side covers and puts the central cover in front', () => {
  const a = coverPose(-2, 300), b = coverPose(2, 300), center = coverPose(0, 300);
  assert.equal(a.x, -b.x); assert.equal(a.rotation, -b.rotation); assert.ok(a.z < center.z); assert.equal(center.scale, 1); assert.ok(center.order > a.order); assert.equal(Math.abs(a.rotation), 65);
});
test('spring motion settles consistently across display rates', () => {
  for (const fps of [30, 60, 120]) { let state = { position: 0, velocity: 0, settled: false }; for (let i = 0; i < fps * 4; i++) state = advanceSpring(state.position, state.velocity, 3, 1 / fps); assert.equal(state.position, 3); assert.equal(state.velocity, 0); assert.equal(state.settled, true); }
});
test('duplicate IDs fail before mounting and before a live list is mutated', () => {
  const f = fixture();
  assert.throws(() => new Coverflow(f.mount, { items: [items()[0], items()[0]] }), /Duplicate/); assert.equal(f.mount.childElementCount, 0);
  const flow = new Coverflow(f.mount, { items: items() });
  assert.throws(() => flow.setItems([items()[0], items()[0]]), /Duplicate/); assert.equal(flow.state.itemCount, 6); flow.dispose(); f.close();
});
test('empty collections can populate and empty again without ghost cards', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: [] });
  assert.equal(flow.state.selectedId, null); assert.equal(flow.state.renderedCards, 0); assert.equal(flow.element.querySelector('.cf-empty')!.hasAttribute('hidden'), false);
  flow.setItems(items(3)); assert.equal(flow.state.selectedId, 'cover-0');
  flow.setItems([]); assert.equal(flow.state.itemCount, 0); assert.equal(flow.element.querySelectorAll('.cf-card').length, 0); flow.dispose(); f.close();
});
test('reordering preserves the selected item by ID and removal picks the nearest item', () => {
  const f = fixture(), initial = items(), flow = new Coverflow(f.mount, { items: initial, selectedId: 'cover-3' });
  flow.setItems([...initial].reverse()); assert.equal(flow.state.selectedId, 'cover-3'); assert.equal(flow.state.selectedIndex, 2);
  flow.setItems(initial.filter(item => item.id !== 'cover-3')); assert.equal(flow.state.selectedIndex, 2); assert.equal(flow.state.selectedId, 'cover-2'); flow.dispose(); f.close();
});
test('repeated images with distinct IDs remain distinct occurrences', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: items(3) });
  assert.equal(flow.state.renderedCards, 3); assert.equal(flow.element.querySelectorAll('.cf-cover').length, 3); flow.dispose(); f.close();
});
test('a large collection renders a bounded window and supports Home/End', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: items(5000), selectedId: 'cover-2500' });
  assert.equal(flow.state.renderedCards, 15); f.key('End'); assert.equal(flow.state.selectedId, 'cover-4999'); assert.ok(flow.state.renderedCards <= 15);
  f.key('Home'); assert.equal(flow.state.selectedId, 'cover-0'); assert.ok(flow.state.renderedCards <= 15); flow.dispose(); f.close();
});
test('keyboard selection emits one event and playback stays controlled by the host', () => {
  const f = fixture(), events: string[] = [], actions: string[] = [];
  const flow = new Coverflow(f.mount, { items: items(), onSelect: (item, _, reason) => events.push(item.id + ':' + reason), onAction: (item, action) => { actions.push(item.id + ':' + action); } });
  f.key('ArrowRight'); assert.deepEqual(events, ['cover-1:keyboard']); f.key('Enter'); assert.deepEqual(actions, ['cover-1:play']); assert.equal(flow.state.playback.isPlaying, false);
  flow.setPlayback({ id: 'cover-1', isPlaying: true }); f.key('Enter'); assert.equal(actions[1], 'cover-1:pause'); flow.dispose(); f.close();
});
test('action callbacks recover errors without inventing playback state', async () => {
  const f = fixture(), errors: Error[] = [];
  const flow = new Coverflow(f.mount, { items: items(), onAction: async () => { throw new Error('Host failed'); }, onError: error => errors.push(error) });
  f.key('Enter'); await Promise.resolve(); await Promise.resolve(); assert.equal(errors[0].message, 'Host failed'); assert.equal(flow.state.playback.isPlaying, false); flow.dispose(); f.close();
});
test('reflections contain artwork only, never mirrored playback controls', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: items(), onAction() {} });
  for (const reflected of flow.element.querySelectorAll('.cf-reflection')) { assert.equal(reflected.getAttribute('aria-hidden'), 'true'); assert.equal(reflected.querySelectorAll('button').length, 0); assert.equal(reflected.querySelectorAll('img').length, 1); }
  flow.setReflection(false); assert.equal(flow.element.classList.contains('cf-no-reflection'), true); flow.dispose(); f.close();
});
test('titles render as text and unsafe artwork URLs use the owned placeholder', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: [{ id: 'safe', title: '<img src=x onerror=alert(1)>', artwork: 'javascript:alert(1)' }] });
  assert.equal(flow.element.querySelector('.cf-title')!.textContent, '<img src=x onerror=alert(1)>'); assert.equal(flow.element.querySelector('.cf-title img'), null); assert.equal(flow.element.querySelector('.cf-image')!.hasAttribute('src'), false); assert.equal(flow.element.querySelector('.cf-card')!.classList.contains('cf-missing'), true); flow.dispose(); f.close();
});
test('settled motion schedules no idle frames and disposal cancels in-flight work', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: items() });
  flow.next(); f.finish(); assert.equal(flow.state.position, 1); assert.equal(f.pending, 0); const frames = flow.diagnostics.renderedFrames;
  f.frame(); assert.equal(flow.diagnostics.renderedFrames, frames); flow.next(); assert.ok(f.pending); flow.dispose(); assert.equal(f.pending, 0); assert.equal(f.mount.childElementCount, 0); assert.throws(() => flow.next(), /disposed/); f.close();
});
test('reduced motion performs direct updates with no animation loop', () => {
  const f = fixture(true), flow = new Coverflow(f.mount, { items: items() }); flow.next(); assert.equal(flow.state.position, 1); assert.equal(f.pending, 0);
  flow.setReducedMotion(false); flow.next(); assert.ok(f.pending); flow.setReducedMotion(true); assert.equal(flow.state.position, 2); assert.equal(f.pending, 0); flow.dispose(); f.close();
});

test('real image URLs remain mounted while invalid media schemes stay rejected', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: [{ id: 'svg', title: 'Original vector cover', artwork: '/assets/original.svg' }, { id: 'bad', title: 'Unsafe', artwork: 'data:text/html,<script>alert(1)</script>' }] });
  const valid = flow.element.querySelector('[data-cf-id="svg"] .cf-image')!;
  assert.equal(valid.getAttribute('src'), 'http://localhost/assets/original.svg'); assert.equal(flow.element.querySelector('[data-cf-id="svg"]')!.classList.contains('cf-missing'), false);
  assert.equal(flow.element.querySelector('[data-cf-id="bad"] .cf-image')!.hasAttribute('src'), false); flow.dispose(); f.close();
});

test('dragging moves in the expected direction and a bubbled capture transfer does not interrupt it', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: items(8), selectedId: 'cover-3', reducedMotion: true });
  const viewport = flow.element.querySelector('.cf-viewport')!, image = flow.element.querySelector('[data-cf-id="cover-3"] .cf-image')!;
  const pointer = (target: Element, type: string, x: number) => { const event = new f.win.MouseEvent(type, { bubbles: true, clientX: x, clientY: 100, button: 0 }); Object.defineProperty(event, 'pointerId', { value: 7 }); target.dispatchEvent(event); };
  pointer(image, 'pointerdown', 500); pointer(viewport, 'pointermove', 370); pointer(image, 'lostpointercapture', 370);
  assert.equal(flow.element.classList.contains('cf-dragging'), true);
  pointer(viewport, 'pointermove', 160); pointer(viewport, 'pointercancel', 160);
  assert.ok(flow.state.selectedIndex > 3); assert.equal(flow.element.classList.contains('cf-dragging'), false); flow.dispose(); f.close();
});
test('removing items during a drag releases the owned pointer capture', () => {
  const f = fixture(), flow = new Coverflow(f.mount, { items: items(), reducedMotion: true }), viewport = flow.element.querySelector('.cf-viewport') as HTMLElement;
  let captured = false, released = false;
  viewport.setPointerCapture = () => { captured = true; }; viewport.hasPointerCapture = () => captured; viewport.releasePointerCapture = () => { captured = false; released = true; };
  for (const [type, x] of [['pointerdown', 500], ['pointermove', 400]] as const) { const event = new f.win.MouseEvent(type, { bubbles: true, clientX: x, button: 0 }); Object.defineProperty(event, 'pointerId', { value: 3 }); viewport.dispatchEvent(event); }
  flow.setItems([]); assert.equal(released, true); assert.equal(captured, false); assert.equal(flow.element.classList.contains('cf-dragging'), false); flow.dispose(); f.close();
});
