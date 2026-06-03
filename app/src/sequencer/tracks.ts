/** Catalog entry: stable id for pattern/MIDI wiring, human-readable name for UI. */
export type TrackDefinition = {
  readonly id: string;
  readonly name: string;
};

/**
 * Ordered track list for UI row order. Pattern data does NOT depend on this order —
 * only on each track's `id`.
 */
export const TRACK_DEFINITIONS = [
  { id: 'kick1', name: 'Kick 1' },
  { id: 'kick2', name: 'Kick 2' },
  { id: 'clap', name: 'Clap' },
  { id: 'snare', name: 'Snare' },
  { id: 'chat', name: 'Closed Hat' },
  { id: 'ohat', name: 'Open Hat' },
  { id: 'perc1', name: 'Perc 1' },
  { id: 'perc2', name: 'Perc 2' },
  { id: 'bass', name: 'Bass' },
  { id: 'lead', name: 'Lead / Stab' },
  { id: 'fx', name: 'FX / Noise' },
] as const satisfies readonly TrackDefinition[];

/** Union of all valid track ids — updates automatically when TRACK_DEFINITIONS grows. */
export type TrackId = (typeof TRACK_DEFINITIONS)[number]['id'];

export const isTrackId = (value: string): value is TrackId =>
  TRACK_DEFINITIONS.some((track) => track.id === value);
