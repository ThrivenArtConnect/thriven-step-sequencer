import type { TrackId } from './tracks.ts';

/** Single grid cell: trigger on/off, probability roll, tie (extra hit at +1/32). */
export type Step = {
  on: boolean;
  prob: boolean;
  tie: boolean;
};

export const STEP_COUNT = 16;

export const PATCH_IDS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
] as const;

export type PatchId = (typeof PATCH_IDS)[number];

/**
 * One bar of sequencing data: one Step[] per track, keyed by stable track id
 * (not by row index in the UI).
 */
export type Pattern = Record<TrackId, Step[]>;

/** Ten pattern slots (A–J) used as song sections in SC view. */
export type PatchBank = Record<PatchId, Pattern>;
