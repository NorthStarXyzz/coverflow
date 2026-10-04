export interface CoverflowItem {
  /** Stable identity for this occurrence. Repeated covers still need unique IDs. */
  id: string;
  title: string;
  subtitle?: string;
  /** An image URL the host has permission to display. No media is fetched by an API. */
  artwork?: string;
  accent?: string;
}
export type SelectionReason = 'pointer' | 'wheel' | 'keyboard' | 'api' | 'items';
export type CoverflowAction = 'play' | 'pause';
export interface PlaybackState { id: string | null; isPlaying: boolean }
export interface CoverflowOptions {
  items: readonly CoverflowItem[];
  selectedId?: string;
  playback?: PlaybackState;
  label?: string;
  reflection?: boolean;
  /** undefined follows prefers-reduced-motion. */
  reducedMotion?: boolean;
  /** Optional maximum artwork size in CSS pixels. */
  maxCardSize?: number;
  onSelect?: (item: CoverflowItem, index: number, reason: SelectionReason) => void;
  /** Host updates playback with setPlayback. No optimistic fake play state. */
  onAction?: (item: CoverflowItem, action: CoverflowAction) => void | Promise<void>;
  onError?: (error: Error) => void;
}
export interface CoverflowState {
  selectedId: string | null;
  selectedIndex: number;
  playback: Readonly<PlaybackState>;
  itemCount: number;
  position: number;
  isAnimating: boolean;
  renderedCards: number;
}
