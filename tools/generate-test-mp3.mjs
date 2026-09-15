import * as lame from '@breezystack/lamejs';
import { writeFileSync } from 'node:fs';

const sampleRate = 44100;
const seconds = 4;
const samples = new Int16Array(sampleRate * seconds);
const notes = [440, 523.251, 659.255, 783.991];

for (let i = 0; i < samples.length; i += 1) {
  const time = i / sampleRate;
  const frequency = notes[Math.min(notes.length - 1, Math.floor(time))];
  const phaseInNote = time % 1;
  const envelope = Math.min(1, phaseInNote * 30) * Math.min(1, (1 - phaseInNote) * 18);
  samples[i] = Math.round(Math.sin(2 * Math.PI * frequency * time) * envelope * 18000);
}

const encoder = new lame.Mp3Encoder(1, sampleRate, 128);
const chunks = [];
for (let offset = 0; offset < samples.length; offset += 1152) {
  const chunk = encoder.encodeBuffer(samples.subarray(offset, offset + 1152));
  if (chunk.length) chunks.push(Buffer.from(chunk));
}
const tail = encoder.flush();
if (tail.length) chunks.push(Buffer.from(tail));

const output = Buffer.concat(chunks);
writeFileSync(new URL('../test-assets/four-note-test.mp3', import.meta.url), output);

const wavHeader = Buffer.alloc(44);
const dataBytes = samples.length * 2;
wavHeader.write('RIFF', 0);
wavHeader.writeUInt32LE(36 + dataBytes, 4);
wavHeader.write('WAVE', 8);
wavHeader.write('fmt ', 12);
wavHeader.writeUInt32LE(16, 16);
wavHeader.writeUInt16LE(1, 20);
wavHeader.writeUInt16LE(1, 22);
wavHeader.writeUInt32LE(sampleRate, 24);
wavHeader.writeUInt32LE(sampleRate * 2, 28);
wavHeader.writeUInt16LE(2, 32);
wavHeader.writeUInt16LE(16, 34);
wavHeader.write('data', 36);
wavHeader.writeUInt32LE(dataBytes, 40);
const wavData = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
const wavOutput = Buffer.concat([wavHeader, wavData]);
writeFileSync(new URL('../test-assets/four-note-test.wav', import.meta.url), wavOutput);

console.log(JSON.stringify({ mp3Bytes: output.length, wavBytes: wavOutput.length, seconds, frequencies: notes, mp3Kbps: 128 }));
