import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import { generateFileData } from '@spotify/basic-pitch/esm/toMidi';
import { marked } from 'marked';
import mp3Article from './articles/mp3-to-midi-practical-workflow.md?raw';
import './styles.css';
import './footer.css';
import './home-umbrella.css';
import './affiliate.css';
import './webmcp.js';

document.querySelector('#article-content').innerHTML = marked.parse(mp3Article);

const fileInput = document.querySelector('#audio-file');
const dropZone = document.querySelector('#drop-zone');
const fileName = document.querySelector('#file-name');
const convertButton = document.querySelector('#convert-button');
const progressWrap = document.querySelector('#progress-wrap');
const progressBar = document.querySelector('#progress-bar');
const progressValue = document.querySelector('#progress-value');
const progressCopy = document.querySelector('#progress-copy');
const result = document.querySelector('#result');
let selectedFile;

function showResult(message, kind, href, downloadName) {
  result.hidden = false;
  result.className = `result ${kind}`;
  result.replaceChildren();
  const text = document.createElement('span');
  text.textContent = message;
  result.append(text);
  if (href) {
    const download = document.createElement('a');
    download.href = href;
    download.download = downloadName;
    download.textContent = 'Download .mid';
    result.append(download);
  }
}

function setProgress(value, message) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  progressWrap.hidden = false;
  progressBar.style.width = `${percent}%`;
  progressValue.textContent = `${percent}%`;
  progressCopy.textContent = message;
}

function setFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  const extension = ['.mp3', '.m4a', '.flac'].find((value) => name.endsWith(value));
  const accepted = extension || ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/flac'].includes(file.type);
  if (!accepted) {
    selectedFile = undefined;
    fileInput.value = '';
    convertButton.disabled = true;
    fileName.textContent = 'Please choose an MP3, M4A, or FLAC file.';
    showResult('This converter accepts MP3, M4A, and FLAC files.', 'error');
    return;
  }
  selectedFile = file;
  fileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  convertButton.disabled = false;
  result.hidden = true;
}

function inputLabel(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.m4a')) return 'M4A';
  if (name.endsWith('.flac')) return 'FLAC';
  return 'MP3';
}

async function toMono22050(audioBuffer) {
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error('This browser does not support offline audio processing.');
  const offline = new OfflineContext(1, Math.max(1, Math.ceil(audioBuffer.duration * 22050)), 22050);
  const source = offline.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

function makeMidi(notes) {
  // Basic Pitch uses Buffer.from only as a final byte wrapper. Browsers already
  // use Uint8Array for the same data, so this keeps generation browser-native.
  globalThis.Buffer ??= { from: (bytes) => new Uint8Array(bytes) };
  return generateFileData(notes);
}

async function convert() {
  if (!selectedFile) return;
  convertButton.disabled = true;
  result.hidden = true;
  try {
    setProgress(4, `Reading your ${inputLabel(selectedFile)} locally…`);
    const bytes = await selectedFile.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('This browser does not support the Web Audio API.');
    const audioContext = new AudioContextClass();
    const decoded = await audioContext.decodeAudioData(bytes.slice(0));
    const resampled = await toMono22050(decoded);
    await audioContext.close();
    setProgress(10, 'Loading the transcription model…');
    const frames = [];
    const onsets = [];
    const basicPitch = new BasicPitch('/basic-pitch-model/model.json');
    await basicPitch.evaluateModel(
      resampled,
      (frameOutput, onsetOutput) => { frames.push(...frameOutput); onsets.push(...onsetOutput); },
      (fraction) => setProgress(10 + fraction * 85, 'Finding notes in your audio…'),
    );
    const notes = noteFramesToTime(outputToNotesPoly(frames, onsets, 0.25, 0.25, 5));
    if (!notes.length) throw new Error('No stable notes were detected. Try a clearer, shorter clip with one instrument or voice.');
    const midiBytes = makeMidi(notes);
    if (!midiBytes || midiBytes.byteLength < 20) throw new Error('The MIDI file could not be created.');
    const filename = `${selectedFile.name.replace(/\.(mp3|m4a|flac)$/i, '') || 'conversion'}.mid`;
    const href = URL.createObjectURL(new Blob([midiBytes], { type: 'audio/midi' }));
    setProgress(100, `Done — ${notes.length} notes found.`);
    showResult(`Your MIDI file is ready. ${notes.length} notes were detected.`, 'success', href, filename);
  } catch (error) {
    console.error(error);
    progressWrap.hidden = true;
    showResult(error instanceof Error ? error.message : 'Conversion did not complete.', 'error');
  } finally {
    convertButton.disabled = !selectedFile;
  }
}

fileInput.addEventListener('change', (event) => setFile(event.target.files?.[0]));
convertButton.addEventListener('click', convert);
['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', (event) => setFile(event.dataTransfer?.files?.[0]));
