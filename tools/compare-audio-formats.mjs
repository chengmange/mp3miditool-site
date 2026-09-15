import decode from 'audio-decode';
import * as tf from '@tensorflow/tfjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { Midi } = require('@tonejs/midi');
const { BasicPitch, noteFramesToTime, outputToNotesPoly } = require('@spotify/basic-pitch');
const { generateFileData } = require('@spotify/basic-pitch/cjs/toMidi.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, '..');
const modelDir = path.join(siteRoot, 'public', 'basic-pitch-model');
const modelJson = JSON.parse(await readFile(path.join(modelDir, 'model.json'), 'utf8'));
const weightSpecs = modelJson.weightsManifest.flatMap((group) => group.weights);
const shardBuffers = [];
for (const group of modelJson.weightsManifest) {
  for (const shard of group.paths) shardBuffers.push(await readFile(path.join(modelDir, shard)));
}
const weightBuffer = Buffer.concat(shardBuffers);
const weightData = weightBuffer.buffer.slice(weightBuffer.byteOffset, weightBuffer.byteOffset + weightBuffer.byteLength);
const model = await tf.loadGraphModel({
  load: async () => ({ modelTopology: modelJson.modelTopology, weightSpecs, weightData }),
});
const transcriber = new BasicPitch(Promise.resolve(model));

function resampleMono(audioBuffer, targetRate = 22050) {
  const channels = audioBuffer.channelData;
  const sourceLength = channels[0].length;
  const outputLength = Math.max(1, Math.ceil(sourceLength * targetRate / audioBuffer.sampleRate));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourcePosition = i * audioBuffer.sampleRate / targetRate;
    const left = Math.min(sourceLength - 1, Math.floor(sourcePosition));
    const right = Math.min(sourceLength - 1, left + 1);
    const fraction = sourcePosition - left;
    let value = 0;
    for (const samples of channels) value += samples[left] + (samples[right] - samples[left]) * fraction;
    output[i] = value / channels.length;
  }
  return output;
}

const pitchNames = new Map([[69, 'A4'], [72, 'C5'], [76, 'E5'], [79, 'G5']]);
const expectedPitches = [...pitchNames.keys()];

async function transcribe(filename) {
  const input = await readFile(path.join(siteRoot, 'test-assets', filename));
  const audio = await decode(input);
  const samples = resampleMono(audio);
  const frames = [];
  const onsets = [];
  await transcriber.evaluateModel(samples, (frameOutput, onsetOutput) => {
    frames.push(...frameOutput);
    onsets.push(...onsetOutput);
  }, () => {});
  const notes = noteFramesToTime(outputToNotesPoly(frames, onsets, 0.25, 0.25, 5));
  const midi = generateFileData(notes);
  const parsedMidi = new Midi(midi);
  const longNotes = notes.filter((note) => note.durationSeconds >= 0.5).length;
  const shortNotes = notes.length - longNotes;
  const detectedPitches = new Set(notes.map((note) => note.pitchMidi));
  const missed = expectedPitches.filter((pitch) => !detectedPitches.has(pitch)).map((pitch) => pitchNames.get(pitch));
  const outputName = filename.replace(/\.(wav|mp3)$/i, '.mid');
  await writeFile(path.join(siteRoot, 'test-assets', outputName), midi);
  return {
    input: filename,
    inputBytes: input.byteLength,
    decodedSampleRate: audio.sampleRate,
    decodedChannels: audio.channelData.length,
    decodedSeconds: Number((audio.channelData[0].length / audio.sampleRate).toFixed(6)),
    noteCount: notes.length,
    longNotes,
    shortNotes,
    missed,
    midiBytes: midi.byteLength,
    midiTracks: parsedMidi.tracks.length,
    midiParsedNoteCount: parsedMidi.tracks.reduce((total, track) => total + track.notes.length, 0),
    detected: notes.map((note) => ({ pitch: note.pitchMidi, start: Number(note.startTimeSeconds.toFixed(4)), duration: Number(note.durationSeconds.toFixed(4)) })),
  };
}

const wav = await transcribe('four-note-test.wav');
const mp3 = await transcribe('four-note-test.mp3');
const comparison = {
  generatedSource: { sampleRate: 44100, channels: 1, seconds: 4, notes: ['A4', 'C5', 'E5', 'G5'], noteSeconds: 1, mp3Kbps: 128 },
  thresholds: { frame: 0.25, onset: 0.25, minimumNoteFrames: 5, longNoteSeconds: 0.5 },
  wav,
  mp3,
};
await writeFile(path.join(siteRoot, 'test-assets', 'wav-mp3-comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`);
console.log(JSON.stringify(comparison));
