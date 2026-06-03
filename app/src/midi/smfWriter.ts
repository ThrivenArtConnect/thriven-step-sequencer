export type MidiTrackEvent = {
  tick: number;
  data: readonly number[];
};

export const encodeVariableLength = (value: number): number[] => {
  let n = Math.max(0, Math.floor(value));
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
};

const compareEvents = (a: MidiTrackEvent, b: MidiTrackEvent): number => {
  if (a.tick !== b.tick) {
    return a.tick - b.tick;
  }
  const aStatus = a.data[0] ?? 0;
  const bStatus = b.data[0] ?? 0;
  return (aStatus & 0xf0) - (bStatus & 0xf0);
};

export const buildTrackChunkBytes = (events: MidiTrackEvent[]): number[] => {
  const sorted = [...events].sort(compareEvents);
  const bytes: number[] = [];
  let lastTick = 0;

  for (const event of sorted) {
    bytes.push(...encodeVariableLength(event.tick - lastTick), ...event.data);
    lastTick = event.tick;
  }

  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return bytes;
};

const pushU32 = (target: number[], value: number): void => {
  target.push(
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  );
};

const pushU16 = (target: number[], value: number): void => {
  target.push((value >> 8) & 0xff, value & 0xff);
};

/** SMF Format 1: track 0 = conductor (tempo), tracks 1…N = note data. */
export const buildFormat1Smf = (
  trackChunks: readonly number[][],
  ppq: number,
  bpm: number,
): Uint8Array => {
  const microsecondsPerQuarter = Math.round(60_000_000 / bpm);
  const conductor = buildTrackChunkBytes([
    {
      tick: 0,
      data: [
        0xff,
        0x51,
        0x03,
        (microsecondsPerQuarter >> 16) & 0xff,
        (microsecondsPerQuarter >> 8) & 0xff,
        microsecondsPerQuarter & 0xff,
      ],
    },
  ]);

  const allTracks = [conductor, ...trackChunks];
  const header: number[] = [];

  header.push(0x4d, 0x54, 0x68, 0x64);
  pushU32(header, 6);
  pushU16(header, 1);
  pushU16(header, allTracks.length);
  pushU16(header, ppq);

  for (const track of allTracks) {
    header.push(0x4d, 0x54, 0x72, 0x6b);
    pushU32(header, track.length);
    header.push(...track);
  }

  return new Uint8Array(header);
};
