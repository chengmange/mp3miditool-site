import { Midi } from '@tonejs/midi';
import { Mp3Encoder } from '@breezystack/lamejs';

export const MIDI_AUDIO_SAMPLE_RATE = 44100;
export const MIDI_AUDIO_LIMITS = Object.freeze({
  maxBytes: 10 * 1024 * 1024,
  maxDurationSeconds: 10 * 60,
  maxNotes: 5000,
});

export function isMidiFile(file) {
  return /\.(mid|midi)$/i.test(file.name) || file.type === 'audio/midi' || file.type === 'audio/x-midi';
}

export function readMidi(arrayBuffer) {
  if (arrayBuffer.byteLength > MIDI_AUDIO_LIMITS.maxBytes) {
    throw new Error('This converter accepts MIDI files up to 10 MB.');
  }

  const midi = new Midi(arrayBuffer);
  const notes = midi.tracks.flatMap((track) => track.notes.map((note) => ({
    pitch: note.midi,
    start: note.time,
    duration: note.duration,
    velocity: note.velocity,
  })));

  if (!notes.length) throw new Error('No note events were found in this MIDI file.');
  if (notes.length > MIDI_AUDIO_LIMITS.maxNotes) {
    throw new Error('This converter accepts up to 5,000 MIDI notes per file.');
  }

  const duration = notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
  if (duration > MIDI_AUDIO_LIMITS.maxDurationSeconds) {
    throw new Error('This converter accepts MIDI performances up to 10 minutes long.');
  }

  return {
    notes,
    duration,
    tempo: midi.header.tempos[0]?.bpm ?? 120,
  };
}

export function renderMidi(notes, duration, onProgress = () => {}) {
  const releaseSeconds = 0.18;
  const sampleRate = MIDI_AUDIO_SAMPLE_RATE;
  const frameCount = Math.max(1, Math.ceil((duration + releaseSeconds) * sampleRate));
  const pcm = new Float32Array(frameCount);

  notes.forEach((note, index) => {
    const startFrame = Math.max(0, Math.floor(note.start * sampleRate));
    const endFrame = Math.min(frameCount, Math.ceil((note.start + note.duration + releaseSeconds) * sampleRate));
    const frequency = 440 * 2 ** ((note.pitch - 69) / 12);
    const amplitude = Math.max(0.05, Math.min(1, note.velocity || 0.8));
    const attackSeconds = Math.min(0.018, Math.max(0.004, note.duration * 0.12));

    for (let frame = startFrame; frame < endFrame; frame += 1) {
      const elapsed = (frame - startFrame) / sampleRate;
      let envelope = 1;
      if (elapsed < attackSeconds) envelope = elapsed / attackSeconds;
      else if (elapsed > note.duration) envelope = Math.max(0, 1 - (elapsed - note.duration) / releaseSeconds);

      const phase = elapsed * frequency * Math.PI * 2;
      const tone = Math.sin(phase) + 0.22 * Math.sin(phase * 2) + 0.08 * Math.sin(phase * 3);
      pcm[frame] += tone * amplitude * envelope * 0.16;
    }

    if (index % 100 === 0 || index === notes.length - 1) onProgress((index + 1) / notes.length);
  });

  let peak = 0;
  for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0.92) {
    const scale = 0.92 / peak;
    for (let index = 0; index < pcm.length; index += 1) pcm[index] *= scale;
  }

  return { pcm, duration: frameCount / sampleRate, sampleRate };
}

function pcm16(pcm) {
  const samples = new Int16Array(pcm.length);
  for (let index = 0; index < pcm.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[index]));
    samples[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return samples;
}

export function encodeWav(pcm, sampleRate = MIDI_AUDIO_SAMPLE_RATE) {
  const samples = pcm16(pcm);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const writeText = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(bytes, 44).set(samples);
  return new Blob([bytes], { type: 'audio/wav' });
}

export function encodeMp3(pcm, sampleRate = MIDI_AUDIO_SAMPLE_RATE) {
  const samples = pcm16(pcm);
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const frameSize = 1152;
  const chunks = [];
  for (let offset = 0; offset < samples.length; offset += frameSize) {
    const frame = samples.subarray(offset, Math.min(samples.length, offset + frameSize));
    const encoded = encoder.encodeBuffer(frame);
    if (encoded.length) chunks.push(new Int8Array(encoded));
  }
  const flushed = encoder.flush();
  if (flushed.length) chunks.push(new Int8Array(flushed));
  return new Blob(chunks, { type: 'audio/mpeg' });
}
