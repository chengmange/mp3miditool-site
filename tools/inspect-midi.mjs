import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const file = process.argv[2];
if (!file) throw new Error('Pass a MIDI file path');
const data = new Uint8Array(await readFile(file));
const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

const ascii = (offset, length) => String.fromCharCode(...data.slice(offset, offset + length));
const readVar = (state) => {
  let value = 0;
  for (let i = 0; i < 4; i += 1) {
    const byte = data[state.offset++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error('Invalid variable-length value');
};

if (ascii(0, 4) !== 'MThd') throw new Error('Missing MThd header');
const headerLength = view.getUint32(4);
const format = view.getUint16(8);
const tracks = view.getUint16(10);
const division = view.getUint16(12);
let offset = 8 + headerLength;
let noteOnEvents = 0;
let noteOffEvents = 0;

for (let trackIndex = 0; trackIndex < tracks; trackIndex += 1) {
  if (ascii(offset, 4) !== 'MTrk') throw new Error(`Missing MTrk at track ${trackIndex}`);
  const trackLength = view.getUint32(offset + 4);
  const state = { offset: offset + 8 };
  const end = state.offset + trackLength;
  let runningStatus = null;

  while (state.offset < end) {
    readVar(state);
    let status = data[state.offset];
    if (status < 0x80) {
      if (runningStatus == null) {
        throw new Error(`Running status without prior status byte at track ${trackIndex}, offset ${state.offset}, value ${status}`);
      }
      status = runningStatus;
    } else {
      state.offset += 1;
      if (status < 0xf0) runningStatus = status;
    }

    if (status === 0xff) {
      state.offset += 1;
      const length = readVar(state);
      state.offset += length;
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      const length = readVar(state);
      state.offset += length;
      continue;
    }

    const command = status & 0xf0;
    const dataLength = command === 0xc0 || command === 0xd0 ? 1 : 2;
    const velocity = dataLength === 2 ? data[state.offset + 1] : 0;
    if (command === 0x90 && velocity > 0) noteOnEvents += 1;
    if (command === 0x80 || (command === 0x90 && velocity === 0)) noteOffEvents += 1;
    state.offset += dataLength;
  }

  offset = end;
}

const fileStat = await stat(file);
console.log(JSON.stringify({
  file,
  bytes: data.byteLength,
  modifiedAt: fileStat.mtime.toISOString(),
  sha256: createHash('sha256').update(data).digest('hex'),
  header: ascii(0, 4),
  headerLength,
  format,
  tracks,
  division,
  noteOnEvents,
  noteOffEvents,
}));
