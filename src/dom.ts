export function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag); node.className = className;
  if (text) node.textContent = text;
  return node;
}
export function imageURL(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (['https:', 'http:', 'blob:'].includes(url.protocol)) return url.href;
    if (url.protocol === 'data:' && /^data:image\/(?:png|jpeg|gif|webp|avif);/i.test(value)) return value;
  } catch { /* Invalid URLs render the owned placeholder. */ }
  return null;
}
export function validateItems<T extends { id: string; title: string; artwork?: string; subtitle?: string }>(items: readonly T[]): T[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || typeof item.title !== 'string' || !item.title.trim()) throw new TypeError('Each cover needs a non-empty id and title.');
    if (ids.has(item.id)) throw new TypeError(`Duplicate cover ID: ${item.id}`);
    if (item.artwork !== undefined && typeof item.artwork !== 'string' || item.subtitle !== undefined && typeof item.subtitle !== 'string') throw new TypeError('Artwork URLs and subtitles must be strings.');
    ids.add(item.id);
  }
  return items.map(item => ({ ...item }));
}
