import { writeFileSync } from 'node:fs';

const sampleRate = 22050;
const seconds = 31;
const frequencies = [440, 523.251, 659.255, 783.991];
const samples = new Int16Array(sampleRate * seconds);

for (let index = 0; index < samples.length; index += 1) {
  const time = index / sampleRate;
  const frequency = frequencies[Math.floor(time) % frequencies.length];
  const phaseInNote = time % 1;
  const envelope = Math.min(1, phaseInNote * 30) * Math.min(1, (1 - phaseInNote) * 18);
  samples[index] = Math.round(Math.sin(2 * Math.PI * frequency * time) * envelope * 18000);
}

const header = Buffer.alloc(44);
const dataBytes = samples.length * 2;
header.write('RIFF', 0);
header.writeUInt32LE(36 + dataBytes, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(dataBytes, 40);
const output = Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)]);
writeFileSync(new URL('../test-assets/thirty-one-second-melody.wav', import.meta.url), output);
console.log(JSON.stringify({ file: 'thirty-one-second-melody.wav', bytes: output.length, sampleRate, channels: 1, seconds, sourceTones: frequencies.length }));
