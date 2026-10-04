import type { CoverflowItem, CoverflowOptions, CoverflowState, PlaybackState, SelectionReason } from './types.js';
import { element, imageURL, validateItems } from './dom.js';
import { advanceSpring, coverPose } from './motion.js';
import { createIcon } from './icons.js';

type Card = { node: HTMLLIElement; select: HTMLButtonElement; image: HTMLImageElement; reflection: HTMLImageElement; action: HTMLButtonElement; url: string | null; cleanup: () => void };
type Pointer = { id: number; startX: number; lastX: number; lastAt: number; origin: number; moved: boolean };

/** A local carousel, independent of any player, framework or media service. */
export class Coverflow {
  readonly element: HTMLDivElement;
  private viewport: HTMLDivElement;
  private list: HTMLUListElement;
  private caption: HTMLDivElement;
  private title: HTMLDivElement;
  private subtitle: HTMLDivElement;
  private live: HTMLSpanElement;
  private empty: HTMLDivElement;
  private doc: Document;
  private win: Window;
  private controller: AbortController;
  private resize?: ResizeObserver;
  private preference?: MediaQueryList;
  private preferenceChanged: () => void;
  private visibilityChanged: () => void;
  private cards = new Map<string, Card>();
  private items: CoverflowItem[];
  private selected = -1;
  private playback: PlaybackState;
  private position = 0;
  private target = 0;
  private velocity = 0;
  private frame = 0;
  private lastFrame = 0;
  private pointer: Pointer | null = null;
  private suppressClickUntil = 0;
  private wheelAt = -Infinity;
  private disposed = false;
  private geometry = { width: 900, height: 530, size: 310, top: 60 };
  private renderedFrames = 0;
  private resizeFallback: () => void;
  constructor(container: HTMLElement, private options: CoverflowOptions) {
    if (!container || container.nodeType !== 1) throw new TypeError('A container element is required.');
    if (options.maxCardSize !== undefined && (!Number.isFinite(options.maxCardSize) || options.maxCardSize < 80)) throw new RangeError('maxCardSize must be at least 80px.');
    this.items = validateItems(options.items);
    this.doc = container.ownerDocument;
    const win = this.doc.defaultView; if (!win) throw new Error('Coverflow requires a browser document.'); this.win = win;
    this.controller = new AbortController();
    this.playback = this.validPlayback(options.playback || { id: null, isPlaying: false });
    this.element = element(this.doc, 'div', 'cf-root');
    this.element.setAttribute('role', 'region'); this.element.setAttribute('aria-roledescription', 'carousel'); this.element.setAttribute('aria-label', options.label || 'Cover carousel');
    this.viewport = element(this.doc, 'div', 'cf-viewport'); this.viewport.tabIndex = 0; this.viewport.setAttribute('role', 'group');
    this.viewport.setAttribute('aria-label', 'Use Left and Right arrows to browse, Home and End to jump, Enter to activate.');
    this.list = element(this.doc, 'ul', 'cf-scene');
    this.empty = element(this.doc, 'div', 'cf-empty', 'No covers yet'); this.empty.setAttribute('role', 'status');
    this.caption = element(this.doc, 'div', 'cf-caption'); this.title = element(this.doc, 'div', 'cf-title'); this.subtitle = element(this.doc, 'div', 'cf-subtitle'); this.caption.append(this.title, this.subtitle);
    this.live = element(this.doc, 'span', 'cf-sr-only'); this.live.setAttribute('aria-live', 'polite'); this.live.setAttribute('aria-atomic', 'true');
    this.viewport.append(this.list, this.empty); this.element.append(this.viewport, this.caption, this.live); container.append(this.element);
    this.preference = this.win.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.preferenceChanged = () => { if (this.reduced) this.finishMotion(); };
    this.preference?.addEventListener('change', this.preferenceChanged);
    this.visibilityChanged = () => { if (this.doc.hidden) this.stopFrame(); else if (Math.abs(this.position - this.target) > .001) this.startFrame(); };
    this.doc.addEventListener('visibilitychange', this.visibilityChanged, { signal: this.controller.signal });
    this.resizeFallback = () => { this.measure(); this.paint(); };
    if (typeof ResizeObserver !== 'undefined') { this.resize = new ResizeObserver(this.resizeFallback); this.resize.observe(this.viewport); }
    else this.win.addEventListener('resize', this.resizeFallback);
    this.measure();
    this.bindEvents();
    const initial = options.selectedId ? this.items.findIndex(item => item.id === options.selectedId) : 0;
    this.selected = this.items.length ? Math.max(0, initial) : -1; this.position = this.target = Math.max(0, this.selected);
    this.paint(); this.announce();
  }
  get state(): CoverflowState { return { selectedId: this.items[this.selected]?.id || null, selectedIndex: this.selected, playback: { ...this.playback }, itemCount: this.items.length, position: this.position, isAnimating: !!this.frame, renderedCards: this.cards.size }; }
  /** Diagnostics describe this renderer only, never user listening history. */
  get diagnostics() { return { renderedFrames: this.renderedFrames, liveCards: this.cards.size, isAnimating: !!this.frame }; }
  private get reduced() { return this.options.reducedMotion ?? this.preference?.matches ?? false; }
  private validPlayback(value: PlaybackState): PlaybackState {
    if (typeof value.isPlaying !== 'boolean' || value.id !== null && typeof value.id !== 'string') throw new TypeError('Playback requires an id (or null) and a boolean isPlaying.');
    return { ...value };
  }
  private assertAlive() { if (this.disposed) throw new Error('This Coverflow instance has been disposed.'); }
  select(id: string, animate = true) { this.assertAlive(); const index = this.items.findIndex(item => item.id === id); if (index < 0) throw new RangeError(`Unknown cover ID: ${id}`); this.go(index, 'api', animate); }
  next() { this.assertAlive(); this.go(this.selected + 1, 'api'); }
  previous() { this.assertAlive(); this.go(this.selected - 1, 'api'); }
  setPlayback(state: PlaybackState) { this.assertAlive(); this.playback = this.validPlayback(state); this.paintPlayback(); }
  setReflection(enabled: boolean) { this.assertAlive(); this.options.reflection = enabled; this.element.classList.toggle('cf-no-reflection', !enabled); }
  setReducedMotion(value: boolean | undefined) { this.assertAlive(); this.options.reducedMotion = value; if (this.reduced) this.finishMotion(); }
  setItems(items: readonly CoverflowItem[]) {
    this.assertAlive(); const next = validateItems(items), selectedId = this.items[this.selected]?.id, anchorIndex = Math.round(this.position), anchorId = this.items[anchorIndex]?.id, fraction = this.position - anchorIndex;
    const oldSelected = this.selected; this.stopFrame(); this.cancelPointer();
    this.items = next;
    const retained = next.findIndex(item => item.id === selectedId);
    this.selected = next.length ? retained >= 0 ? retained : Math.min(Math.max(0, oldSelected), next.length - 1) : -1;
    const anchor = next.findIndex(item => item.id === anchorId);
    this.position = anchor >= 0 ? anchor + fraction : Math.max(0, this.selected); this.target = Math.max(0, this.selected); this.velocity = 0;
    this.paint(); this.announce();
    if (selectedId !== this.items[this.selected]?.id && this.selected >= 0) this.notify(this.selected, 'items');
    if (!this.reduced && Math.abs(this.position - this.target) > .001) this.startFrame();
  }
  private bindEvents() {
    const listen = (type: string, fn: EventListener, passive = false) => this.viewport.addEventListener(type, fn, { passive, signal: this.controller.signal });
    listen('keydown', event => {
      const e = event as KeyboardEvent; if (!this.items.length) return;
      if ((e.target as Element | null)?.closest?.('[data-cf-action]')) return;
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']; if (!keys.includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'Enter' || e.key === ' ') { this.activate(this.selected); return; }
      this.go(e.key === 'Home' ? 0 : e.key === 'End' ? this.items.length - 1 : this.selected + (e.key === 'ArrowRight' ? 1 : -1), 'keyboard');
    });
    listen('wheel', event => {
      const e = event as WheelEvent, delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!this.items.length || Math.abs(delta) < 3 || e.ctrlKey) return;
      e.preventDefault(); const now = this.win.performance.now(); if (now - this.wheelAt < 150) return;
      this.wheelAt = now; this.go(this.selected + Math.sign(delta), 'wheel');
    });
    listen('pointerdown', event => {
      const e = event as PointerEvent;
      if (e.button !== 0 || !this.items.length || (e.target as Element).closest('[data-cf-action]')) return;
      this.stopFrame(); this.velocity = 0; this.viewport.focus({ preventScroll: true });
      this.pointer = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastAt: this.win.performance.now(), origin: this.position, moved: false };
    });
    listen('pointermove', event => {
      const e = event as PointerEvent, pointer = this.pointer; if (!pointer || pointer.id !== e.pointerId) return;
      const now = this.win.performance.now(), delta = e.clientX - pointer.startX;
      if (Math.abs(delta) > 5 && !pointer.moved) { pointer.moved = true; this.viewport.setPointerCapture?.(e.pointerId); this.element.classList.add('cf-dragging'); }
      if (!pointer.moved) return;
      this.position = Math.max(-.2, Math.min(this.items.length - .8, pointer.origin - delta / this.geometry.size));
      this.velocity = -(e.clientX - pointer.lastX) / this.geometry.size / Math.max(.008, (now - pointer.lastAt) / 1000);
      pointer.lastX = e.clientX; pointer.lastAt = now; this.paint();
    });
    const release = (event: Event) => {
      const e = event as PointerEvent, pointer = this.pointer; if (!pointer || pointer.id !== e.pointerId) return;
      if (e.type === 'lostpointercapture' && e.target !== this.viewport) return;
      this.pointer = null; this.element.classList.remove('cf-dragging');
      if (this.viewport.hasPointerCapture?.(e.pointerId)) this.viewport.releasePointerCapture(e.pointerId);
      if (pointer.moved) { const fresh = e.type === 'pointerup' && this.win.performance.now() - pointer.lastAt < 100 ? this.velocity : 0; this.go(Math.round(this.position + fresh * .18), 'pointer'); this.suppressClickUntil = this.win.performance.now() + 300; }
      else if (e.type === 'pointerup') {
        const card = this.pick(e.clientX, e.clientY); if (card) { this.clickCard(Number(card.node.dataset.index)); this.suppressClickUntil = this.win.performance.now() + 300; }
      }
      else this.go(Math.round(this.position), 'pointer');
    };
    listen('pointerup', release); listen('pointercancel', release); listen('lostpointercapture', release);
    listen('click', event => {
      if (this.win.performance.now() < this.suppressClickUntil) { event.preventDefault(); return; }
      const target = event.target as Element, action = target.closest<HTMLElement>('[data-cf-action]'), cover = target.closest<HTMLElement>('[data-cf-id]');
      if (!cover) return; const index = Number(cover.dataset.index);
      if (action) this.activate(index); else this.clickCard(index);
    });
  }
  private clickCard(index: number) { if (index === this.selected && Math.abs(this.position - index) < .1) this.activate(index); else this.go(index, 'pointer'); }
  private pick(x: number, y: number): Card | undefined {
    return [...this.cards.values()].filter(card => { const r = card.image.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }).sort((a, b) => Math.abs(Number(a.node.dataset.index) - this.position) - Math.abs(Number(b.node.dataset.index) - this.position))[0];
  }
  private cancelPointer() {
    const pointer = this.pointer; this.pointer = null; this.element.classList.remove('cf-dragging');
    if (pointer && this.viewport.hasPointerCapture?.(pointer.id)) this.viewport.releasePointerCapture(pointer.id);
  }
  private activate(index: number) {
    const item = this.items[index]; if (!item || !this.options.onAction) return;
    const action = this.playback.id === item.id && this.playback.isPlaying ? 'pause' : 'play';
    this.invoke(() => this.options.onAction!(item, action));
  }
  private invoke(action: () => void | Promise<void>) {
    try { const result = action(); if (result && typeof result.then === 'function') void result.catch(error => this.report(error)); }
    catch (error) { this.report(error); }
  }
  private report(value: unknown) {
    if (this.disposed) return; const error = value instanceof Error ? value : new Error(String(value));
    if (this.options.onError) { try { this.options.onError(error); } catch { /* Error handlers must not break animation cleanup. */ } }
    else { const event = this.doc.createEvent('CustomEvent'); event.initCustomEvent('coverflowerror', false, false, error); this.element.dispatchEvent(event); }
  }
  private notify(index: number, reason: SelectionReason) { const item = this.items[index]; if (item && this.options.onSelect) this.invoke(() => this.options.onSelect!(item, index, reason)); }
  private go(index: number, reason: SelectionReason, animate = true) {
    if (this.disposed || !this.items.length) return;
    const target = Math.max(0, Math.min(this.items.length - 1, Math.round(index))), changed = this.selected !== target;
    this.selected = target; this.target = target;
    if (this.reduced || !animate || Math.abs(this.position - target) > 15) this.finishMotion();
    else { this.paint(); this.startFrame(); }
    if (changed) { this.announce(); this.notify(target, reason); }
  }
  private announce() {
    const item = this.items[this.selected]; this.caption.hidden = !item;
    this.title.textContent = item?.title || ''; this.subtitle.textContent = item?.subtitle || '';
    this.live.textContent = item ? `${item.title}, ${this.selected + 1} of ${this.items.length}` : 'No covers';
  }
  private startFrame() { if (this.frame || this.disposed || this.doc.hidden) return; this.lastFrame = this.win.performance.now(); this.frame = this.win.requestAnimationFrame(this.tick); }
  private stopFrame() { if (this.frame) this.win.cancelAnimationFrame(this.frame); this.frame = 0; }
  private finishMotion() { this.stopFrame(); this.position = this.target; this.velocity = 0; this.paint(); }
  private tick = (now: number) => {
    this.frame = 0; if (this.disposed || this.doc.hidden) return;
    const spring = advanceSpring(this.position, this.velocity, this.target, (now - this.lastFrame) / 1000); this.lastFrame = now;
    this.position = spring.position; this.velocity = spring.velocity; this.paint(); this.renderedFrames++;
    if (!spring.settled) this.frame = this.win.requestAnimationFrame(this.tick);
  };
  private measure() {
    const width = this.viewport.clientWidth || this.element.clientWidth || 900, height = this.viewport.clientHeight || 530;
    const size = Math.max(80, Math.min(width * (width < 600 ? .62 : .32), height * .57, this.options.maxCardSize || 390));
    this.geometry = { width, height, size, top: Math.max(20, (height - size) / 2 - size * .16) };
    this.element.style.setProperty('--cf-card-size', `${size}px`);
  }
  private createCard(item: CoverflowItem): Card {
    const node = element(this.doc, 'li', 'cf-card cf-missing'); node.dataset.cfId = item.id;
    const select = element(this.doc, 'button', 'cf-cover'); select.type = 'button'; select.tabIndex = -1;
    const image = element(this.doc, 'img', 'cf-image'); image.draggable = false; image.alt = item.title; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    const placeholder = element(this.doc, 'span', 'cf-placeholder'); placeholder.setAttribute('aria-hidden', 'true');
    const reflectionBox = element(this.doc, 'div', 'cf-reflection'); reflectionBox.setAttribute('aria-hidden', 'true');
    const reflection = element(this.doc, 'img', 'cf-reflection-image'); reflection.alt = ''; reflection.draggable = false; reflection.decoding = 'async'; reflection.referrerPolicy = 'no-referrer'; reflectionBox.append(reflection);
    const action = element(this.doc, 'button', 'cf-action'); action.type = 'button'; action.dataset.cfAction = 'true';
    action.append(createIcon(this.doc, 'play')); node.append(select, reflectionBox, action); select.append(placeholder, image);
    const failed = () => { if (!this.disposed) node.classList.add('cf-missing'); };
    const loaded = () => { if (!this.disposed) node.classList.remove('cf-missing'); };
    image.addEventListener('error', failed); image.addEventListener('load', loaded);
    const cleanup = () => { image.removeEventListener('error', failed); image.removeEventListener('load', loaded); image.removeAttribute('src'); reflection.removeAttribute('src'); };
    return { node, select, image, reflection, action, url: null, cleanup };
  }
  private paint() {
    if (this.disposed) return;
    this.element.classList.toggle('cf-no-reflection', this.options.reflection === false); this.element.classList.toggle('cf-reduced', this.reduced);
    this.empty.hidden = !!this.items.length; this.viewport.setAttribute('aria-disabled', String(!this.items.length));
    const center = Math.max(0, Math.min(this.items.length - 1, Math.round(this.position))), start = Math.max(0, center - 7), end = Math.min(this.items.length - 1, center + 7), keep = new Set<string>();
    for (let index = start; index <= end; index++) {
      const item = this.items[index]!; keep.add(item.id); let card = this.cards.get(item.id);
      if (!card) { card = this.createCard(item); this.cards.set(item.id, card); this.list.append(card.node); }
      const node = card.node, pose = coverPose(index - this.position, this.geometry.size), selected = index === this.selected;
      if (node.dataset.index !== String(index)) node.dataset.index = String(index); node.classList.toggle('cf-selected', selected);
      node.style.top = `${this.geometry.top}px`; node.style.transform = `translateX(-50%) translate3d(${pose.x}px,0,${pose.z}px) rotateY(${pose.rotation}deg) scale(${pose.scale})`;
      node.style.opacity = String(pose.opacity); node.style.zIndex = String(pose.order); card.select.style.filter = `brightness(${pose.brightness})`;
      card.select.setAttribute('aria-label', `${this.options.onAction ? 'Select or activate' : 'Select'} ${item.title}`); card.select.setAttribute('aria-pressed', String(selected));
      if (card.image.alt !== item.title) card.image.alt = item.title;
      if (item.accent && /^#[a-f\d]{3,8}$/i.test(item.accent)) node.style.setProperty('--cf-item-accent', item.accent); else node.style.removeProperty('--cf-item-accent');
      const url = imageURL(item.artwork, this.doc.baseURI);
      if (url !== card.url) { card.url = url; if (url) { card.image.src = url; card.reflection.src = url; } else { card.image.removeAttribute('src'); card.reflection.removeAttribute('src'); } node.classList.toggle('cf-missing', !url); }
    }
    for (const [id, card] of this.cards) if (!keep.has(id)) { card.cleanup(); card.node.remove(); this.cards.delete(id); }
    this.paintPlayback();
  }
  private paintPlayback() {
    for (const [id, card] of this.cards) {
      const playing = id === this.playback.id && this.playback.isPlaying, selected = id === this.items[this.selected]?.id;
      card.node.classList.toggle('cf-playing', playing); card.action.hidden = !this.options.onAction || !selected;
      card.action.tabIndex = selected && this.options.onAction ? 0 : -1; const label = `${playing ? 'Pause' : 'Play'} ${this.items[Number(card.node.dataset.index)]?.title || ''}`; if (card.action.getAttribute('aria-label') !== label) card.action.setAttribute('aria-label', label);
      const mode = playing ? 'pause' : 'play'; if (card.action.dataset.mode !== mode) { card.action.dataset.mode = mode; card.action.replaceChildren(createIcon(this.doc, mode)); }
    }
  }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.stopFrame(); this.cancelPointer();
    this.controller.abort(); this.resize?.disconnect(); this.preference?.removeEventListener('change', this.preferenceChanged); this.win.removeEventListener('resize', this.resizeFallback);
    for (const card of this.cards.values()) card.cleanup(); this.cards.clear(); this.element.remove();
  }
}
