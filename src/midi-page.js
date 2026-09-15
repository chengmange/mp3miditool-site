import { marked } from 'marked';
import midiArticle from './articles/convert-midi-to-mp3-second-article.md?raw';
import { encodeMp3, encodeWav, isMidiFile, MIDI_AUDIO_LIMITS, readMidi, renderMidi } from './midi-audio.js';
import './styles.css';
import './footer.css';
import './affiliate.css';
import './midi-audio.css';

document.querySelector('#article-content').innerHTML = marked.parse(midiArticle);

const fileInput = document.querySelector('#midi-file');
const dropZone = document.querySelector('#midi-drop-zone');
const fileName = document.querySelector('#midi-file-name');
const outputFormat = document.querySelector('#output-format');
const convertButton = document.querySelector('#midi-convert-button');
const progressWrap = document.querySelector('#midi-progress-wrap');
const progressBar = document.querySelector('#midi-progress-bar');
const progressValue = document.querySelector('#midi-progress-value');
const progressCopy = document.querySelector('#midi-progress-copy');
const result = document.querySelector('#midi-result');
const audioResult = document.querySelector('#midi-audio-result');
const preview = document.querySelector('#midi-preview');
const downloads = document.querySelector('#midi-downloads');
let selectedFile;
let outputUrl;

function showResult(message, kind) {
  result.hidden = false;
  result.className = `result ${kind}`;
  result.textContent = message;
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
  if (!isMidiFile(file)) {
    selectedFile = undefined;
    fileInput.value = '';
    convertButton.disabled = true;
    fileName.textContent = 'Please choose a .mid or .midi file.';
    showResult('This page accepts MIDI files only: .mid or .midi.', 'error');
    return;
  }
  if (file.size > MIDI_AUDIO_LIMITS.maxBytes) {
    selectedFile = undefined;
    fileInput.value = '';
    convertButton.disabled = true;
    fileName.textContent = 'The file is too large.';
    showResult('This converter accepts MIDI files up to 10 MB.', 'error');
    return;
  }
  selectedFile = file;
  fileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  convertButton.disabled = false;
  result.hidden = true;
  audioResult.hidden = true;
}

function addDownload(label, blob, filename) {
  const link = document.createElement('a');
  link.href = outputUrl;
  link.download = filename;
  link.textContent = label;
  downloads.append(link);
}

async function convert() {
  if (!selectedFile) return;
  convertButton.disabled = true;
  result.hidden = true;
  audioResult.hidden = true;
  downloads.replaceChildren();
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  try {
    setProgress(5, 'Reading MIDI note events locally…');
    const parsed = readMidi(await selectedFile.arrayBuffer());
    setProgress(12, `Rendering ${parsed.notes.length} notes locally…`);
    const rendered = renderMidi(parsed.notes, parsed.duration, (fraction) => setProgress(12 + fraction * 76, 'Rendering MIDI audio locally…'));
    setProgress(90, 'Encoding the audio file…');
    const format = outputFormat.value;
    const blob = format === 'wav' ? encodeWav(rendered.pcm, rendered.sampleRate) : encodeMp3(rendered.pcm, rendered.sampleRate);
    if (blob.size < 100) throw new Error('The audio file could not be created.');
    outputUrl = URL.createObjectURL(blob);
    preview.src = outputUrl;
    preview.load();
    audioResult.hidden = false;
    const stem = selectedFile.name.replace(/\.(mid|midi)$/i, '') || 'midi-render';
    const extension = format === 'wav' ? 'wav' : 'mp3';
    addDownload(`Download .${extension}`, blob, `${stem}.${extension}`);
    setProgress(100, 'Audio ready.');
    showResult(`Done — ${rendered.duration.toFixed(2)} seconds, ${format.toUpperCase()} output.`, 'success');
  } catch (error) {
    console.error(error);
    progressWrap.hidden = true;
    showResult(error instanceof Error ? error.message : 'The audio could not be created.', 'error');
  } finally {
    convertButton.disabled = !selectedFile;
  }
}

fileInput.addEventListener('change', (event) => setFile(event.target.files?.[0]));
convertButton.addEventListener('click', convert);
['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', (event) => setFile(event.dataTransfer?.files?.[0]));
