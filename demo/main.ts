import { Coverflow, type CoverflowItem, type CoverflowAction } from '../src/index.js';
import { createIcon } from '../src/icons.js';
import '../src/style.css';
import './style.css';

const artworks = [
  new URL('../assets/covers/afterglow.svg?no-inline', import.meta.url).href,
  new URL('../assets/covers/tideline.svg?no-inline', import.meta.url).href,
  new URL('../assets/covers/nocturne.svg?no-inline', import.meta.url).href,
  new URL('../assets/covers/arcadia.svg?no-inline', import.meta.url).href,
  new URL('../assets/covers/quiet-orbit.svg?no-inline', import.meta.url).href,
  new URL('../assets/covers/silver-haze.svg?no-inline', import.meta.url).href,
];
const titles = ['Afterglow', 'Tideline', 'Nocturne', 'Arcadia', 'Quiet Orbit', 'Silver Haze'];
const items: CoverflowItem[] = titles.map((title, index) => ({ id: title.toLowerCase().replaceAll(' ', '-'), title, subtitle: 'Original studies · Volume ' + String(index + 1).padStart(2, '0'), artwork: artworks[index], accent: ['#b37a51','#5b8889','#5d708c','#937c87','#8e916b','#828792'][index] }));
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let playing: string | null = null, isPlaying = false;
function action(item: CoverflowItem, mode: CoverflowAction) {
  playing = item.id; isPlaying = mode === 'play'; flow.setPlayback({ id: playing, isPlaying }); sync();
}
const flow = new Coverflow(get('gallery'), {
  items, selectedId: 'nocturne', label: 'Original vector cover studies',
  onSelect: () => sync(), onAction: action,
  onError: error => { get('playback-label').textContent = error.message; },
});
get('previous').append(createIcon(document, 'previous')); get('next').append(createIcon(document, 'next'));
get('previous').addEventListener('click', () => flow.previous()); get('next').addEventListener('click', () => flow.next());
get('toggle-play').addEventListener('click', () => { const item = items[flow.state.selectedIndex]; if (item) action(item, playing === item.id && isPlaying ? 'pause' : 'play'); });
function sync() {
  const state = flow.state, item = items[state.selectedIndex];
  get('selection-name').textContent = item?.title || 'No selection';
  get('position-label').textContent = `${String(state.selectedIndex + 1).padStart(2, '0')} / ${String(state.itemCount).padStart(2, '0')}`;
  (get('previous') as HTMLButtonElement).disabled = state.selectedIndex <= 0; (get('next') as HTMLButtonElement).disabled = state.selectedIndex >= state.itemCount - 1;
  const active = playing === item?.id && isPlaying;
  get('toggle-play').replaceChildren(createIcon(document, active ? 'pause' : 'play')); get('toggle-play').setAttribute('aria-label', `${active ? 'Pause' : 'Play'} ${item?.title || 'selected cover'}`);
  get('playback-label').textContent = playing ? `${isPlaying ? 'Playing' : 'Paused'} ${items.find(item => item.id === playing)?.title} · simulated` : 'Demo playback is simulated.';
}
get<HTMLInputElement>('reflection-toggle').addEventListener('change', event => flow.setReflection((event.target as HTMLInputElement).checked));
get<HTMLInputElement>('motion-toggle').checked = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
get<HTMLInputElement>('motion-toggle').addEventListener('change', event => flow.setReducedMotion((event.target as HTMLInputElement).checked));
get('theme-toggle').addEventListener('click', () => {
  const dark = document.body.dataset.theme !== 'dark'; document.body.dataset.theme = dark ? 'dark' : 'light';
  get('theme-toggle').textContent = dark ? 'Light' : 'Dark'; get('theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} appearance`);
});
sync();
// Keep a scoped demo handle for DOM-based acceptance and examples; no account data.
Object.assign(window, { coverflowDemo: flow });
window.addEventListener('pagehide', () => flow.dispose(), { once: true });
