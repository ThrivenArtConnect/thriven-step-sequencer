import { TRACK_DEFINITIONS, type TrackId } from '../sequencer/tracks.ts';
import type { Pattern, Step } from '../sequencer/types.ts';
import { STEP_COUNT } from '../sequencer/types.ts';
import {
  MIDI_NOTE_OFF_VELOCITY,
  MIDI_NOTE_ON_VELOCITY,
  MIDI_PPQ,
  MIDI_STEP_TICKS,
  MIDI_TIE_OFFSET_TICKS,
  MIDI_TIE_VELOCITY,
} from './constants.ts';
import { buildFormat1Smf, buildTrackChunkBytes, type MidiTrackEvent } from './smfWriter.ts';
import { getTrackMidiMapping } from './trackMapping.ts';

export type PatternBar = {
  pattern: Pattern;
};

const noteOn = (channel: number, note: number, velocity: number): number[] => [
  0x90 | channel,
  note & 0x7f,
  velocity & 0x7f,
];

const noteOff = (channel: number, note: number, velocity: number): number[] => [
  0x80 | channel,
  note & 0x7f,
  velocity & 0x7f,
];

const pushNotePair = (
  events: MidiTrackEvent[],
  tick: number,
  channel: number,
  note: number,
  durationTicks: number,
  velocity: number,
): void => {
  const safeDuration = Math.max(1, durationTicks);
  events.push(
    { tick, data: noteOn(channel, note, velocity) },
    {
      tick: tick + safeDuration - 1,
      data: noteOff(channel, note, MIDI_NOTE_OFF_VELOCITY),
    },
  );
};

const pushStepNotes = (
  events: MidiTrackEvent[],
  barStartTick: number,
  stepIndex: number,
  cell: Step,
  channel: number,
  note: number,
): void => {
  if (!cell.on) {
    return;
  }

  const stepStart = barStartTick + stepIndex * MIDI_STEP_TICKS;

  pushNotePair(
    events,
    stepStart,
    channel,
    note,
    MIDI_STEP_TICKS,
    MIDI_NOTE_ON_VELOCITY,
  );

  if (cell.tie) {
    const rollStart = stepStart + MIDI_TIE_OFFSET_TICKS;
    pushNotePair(
      events,
      rollStart,
      channel,
      note,
      MIDI_TIE_OFFSET_TICKS,
      MIDI_TIE_VELOCITY,
    );
  }
};

const collectTrackEvents = (
  trackId: TrackId,
  bars: readonly PatternBar[],
): MidiTrackEvent[] => {
  const { channel, note } = getTrackMidiMapping(trackId);
  const events: MidiTrackEvent[] = [];

  bars.forEach((bar, barIndex) => {
    const barStartTick = barIndex * STEP_COUNT * MIDI_STEP_TICKS;
    const row = bar.pattern[trackId];

    for (let stepIndex = 0; stepIndex < STEP_COUNT; stepIndex += 1) {
      pushStepNotes(events, barStartTick, stepIndex, row[stepIndex], channel, note);
    }
  });

  return events;
};

export const buildMidiFromBars = (bars: readonly PatternBar[], bpm: number): Uint8Array => {
  const trackChunks = TRACK_DEFINITIONS.map(({ id }) =>
    buildTrackChunkBytes(collectTrackEvents(id, bars)),
  );

  return buildFormat1Smf(trackChunks, MIDI_PPQ, bpm);
};

export const downloadMidiBlob = (bytes: Uint8Array, filename: string): void => {
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'audio/midi' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};
