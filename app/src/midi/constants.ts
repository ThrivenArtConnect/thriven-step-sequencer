/** Pulses per quarter note (SMF division). */
export const MIDI_PPQ = 96;

/** One 16th note in ticks (96 / 4). */
export const MIDI_STEP_TICKS = MIDI_PPQ / 4;

/** Tie roll offset: one 32nd note = half a 16th. */
export const MIDI_TIE_OFFSET_TICKS = MIDI_STEP_TICKS / 2;

export const MIDI_NOTE_ON_VELOCITY = 100;
export const MIDI_NOTE_OFF_VELOCITY = 0;
export const MIDI_TIE_VELOCITY = 90;
