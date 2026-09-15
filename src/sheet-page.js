import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import { generateFileData } from '@spotify/basic-pitch/esm/toMidi';
import { Midi } from '@tonejs/midi';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import './styles.css';
import './footer.css';
import './wav-page.css';
import './sheet-page.css';
import './midi-page.css';
import './affiliate.css';

const midiOnlyPage = document.body.dataset.page === 'midi-to-sheet-music';
const MAX_MIDI_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MIDI_DURATION_SECONDS = 10 * 60;
const MAX_MIDI_NOTES = 5000;

const fileInput = document.querySelector('#audio-file');
const dropZone = document.querySelector('#drop-zone');
const fileName = document.querySelector('#file-name');
const tempoInput = document.querySelector('#tempo');
const convertButton = document.querySelector('#convert-button');
const progressWrap = document.querySelector('#progress-wrap');
const progressBar = document.querySelector('#progress-bar');
const progressValue = document.querySelector('#progress-value');
const progressCopy = document.querySelector('#progress-copy');
const result = document.querySelector('#result');
const scoreSection = document.querySelector('#score-section');
const scoreOutput = document.querySelector('#score-output');
const scoreDownloads = document.querySelector('#score-downloads');
const noteCount = document.querySelector('#note-count');
const pageCount = document.querySelector('#page-count');
const elapsedTime = document.querySelector('#elapsed-time');
let selectedFile;
let objectUrls = [];

function acceptedFormat(file) {
  if (midiOnlyPage) return isMidi(file);
  return /\.(mp3|wav|mid|midi)$/i.test(file.name) || ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/midi'].includes(file.type);
}

function isMidi(file) {
  return /\.(mid|midi)$/i.test(file.name) || file.type === 'audio/midi';
}

function setProgress(value, message) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  progressWrap.hidden = false;
  progressBar.style.width = `${percent}%`;
  progressValue.textContent = `${percent}%`;
  progressCopy.textContent = message;
}

function showResult(message, kind) {
  result.hidden = false;
  result.className = `result ${kind}`;
  result.textContent = message;
}

function setFile(file) {
  if (!file) return;
  if (!acceptedFormat(file)) {
    selectedFile = undefined;
    fileInput.value = '';
    convertButton.disabled = true;
    fileName.textContent = midiOnlyPage ? 'Please choose a .mid or .midi file.' : 'Please choose an MP3, WAV, MID, or MIDI file.';
    showResult(midiOnlyPage ? 'This page accepts MIDI files only: .mid or .midi.' : 'This converter accepts MP3, WAV, MID, and MIDI files.', 'error');
    return;
  }
  if (midiOnlyPage && file.size > MAX_MIDI_FILE_BYTES) {
    selectedFile = undefined;
    fileInput.value = '';
    convertButton.disabled = true;
    fileName.textContent = 'The file is too large.';
    showResult('This page accepts MIDI files up to 10 MB.', 'error');
    return;
  }
  selectedFile = file;
  fileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  convertButton.disabled = false;
  result.hidden = true;
  scoreSection.hidden = true;
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

async function audioToNotes(file) {
  setProgress(4, 'Reading the recording locally…');
  const bytes = await file.arrayBuffer();
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
    (fraction) => setProgress(10 + fraction * 70, 'Detecting pitches and note lengths…'),
  );
  return noteFramesToTime(outputToNotesPoly(frames, onsets, 0.25, 0.25, 5));
}

async function midiToNotes(file) {
  setProgress(20, 'Reading MIDI note events…');
  const midi = new Midi(await file.arrayBuffer());
  const bpm = midi.header.tempos[0]?.bpm;
  if (Number.isFinite(bpm)) tempoInput.value = String(Math.round(bpm));
  const notes = midi.tracks.flatMap((track) => track.notes.map((note) => ({
    pitchMidi: note.midi,
    startTimeSeconds: note.time,
    durationSeconds: note.duration,
    amplitude: note.velocity,
  })));
  if (midiOnlyPage && notes.length > MAX_MIDI_NOTES) throw new Error('This page accepts up to 5,000 MIDI notes per file.');
  const duration = notes.reduce((end, note) => Math.max(end, note.startTimeSeconds + note.durationSeconds), 0);
  if (midiOnlyPage && duration > MAX_MIDI_DURATION_SECONDS) throw new Error('This page accepts MIDI performances up to 10 minutes long.');
  return notes;
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]);
}

function pitchXml(midi) {
  const names = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const [step, alter] = names[((Math.round(midi) % 12) + 12) % 12];
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;
}

function durationMarkup(duration) {
  const map = { 1: ['16th', false], 2: ['eighth', false], 3: ['eighth', true], 4: ['quarter', false], 6: ['quarter', true], 8: ['half', false], 12: ['half', true], 16: ['whole', false] };
  const [type, dotted] = map[duration] || ['16th', false];
  return `<duration>${duration}</duration><type>${type}</type>${dotted ? '<dot/>' : ''}`;
}

function decomposeDuration(duration) {
  const values = [16, 12, 8, 6, 4, 3, 2, 1];
  const parts = [];
  let remaining = Math.max(1, Math.round(duration));
  while (remaining > 0) {
    const value = values.find((candidate) => candidate <= remaining) || 1;
    parts.push(value);
    remaining -= value;
  }
  return parts;
}

function buildMusicXml(rawNotes, bpm, title) {
  const divisions = 4;
  const measureLength = 16;
  const notes = rawNotes
    .filter((note) => Number.isFinite(note.pitchMidi) && Number.isFinite(note.startTimeSeconds) && Number.isFinite(note.durationSeconds) && note.durationSeconds > 0)
    .map((note) => ({
      pitch: Math.round(note.pitchMidi),
      start: Math.max(0, Math.round(note.startTimeSeconds * bpm * divisions / 60)),
      duration: Math.max(1, Math.round(note.durationSeconds * bpm * divisions / 60)),
    }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  if (!notes.length) throw new Error('No stable notes were detected. Try a clearer recording with one instrument or voice.');

  const grouped = [];
  for (const note of notes) {
    const last = grouped.at(-1);
    if (last && last.start === note.start) {
      if (!last.pitches.includes(note.pitch)) last.pitches.push(note.pitch);
      last.duration = Math.max(last.duration, note.duration);
    } else {
      grouped.push({ start: note.start, duration: note.duration, pitches: [note.pitch] });
    }
  }
  grouped.forEach((event, index) => {
    const next = grouped[index + 1];
    if (next && next.start > event.start) event.duration = Math.max(1, Math.min(event.duration, next.start - event.start));
  });

  const measures = [];
  const ensureMeasure = (index) => { while (measures.length <= index) measures.push([]); return measures[index]; };
  const addSpan = (absoluteStart, duration, pitches = []) => {
    let cursor = absoluteStart;
    let remaining = duration;
    const pieces = [];
    while (remaining > 0) {
      const room = measureLength - (cursor % measureLength || 0);
      const withinMeasure = Math.min(remaining, room || measureLength);
      for (const value of decomposeDuration(withinMeasure)) {
        pieces.push({ start: cursor, duration: value, pitches });
        cursor += value;
        remaining -= value;
      }
    }
    pieces.forEach((piece, pieceIndex) => {
      const measure = ensureMeasure(Math.floor(piece.start / measureLength));
      if (!piece.pitches.length) {
        measure.push(`<note><rest/>${durationMarkup(piece.duration)}</note>`);
        return;
      }
      const tieStop = pieceIndex > 0;
      const tieStart = pieceIndex < pieces.length - 1;
      piece.pitches.forEach((pitch, pitchIndex) => {
        const chord = pitchIndex ? '<chord/>' : '';
        const ties = `${tieStop ? '<tie type="stop"/>' : ''}${tieStart ? '<tie type="start"/>' : ''}`;
        const notations = tieStop || tieStart ? `<notations>${tieStop ? '<tied type="stop"/>' : ''}${tieStart ? '<tied type="start"/>' : ''}</notations>` : '';
        measure.push(`<note>${chord}${pitchXml(pitch)}${durationMarkup(piece.duration)}${ties}<voice>1</voice>${notations}</note>`);
      });
    });
  };

  let cursor = 0;
  for (const event of grouped) {
    const start = Math.max(cursor, event.start);
    if (start > cursor) addSpan(cursor, start - cursor);
    addSpan(start, event.duration, event.pitches);
    cursor = start + event.duration;
  }
  const paddedEnd = Math.ceil(cursor / measureLength) * measureLength;
  if (paddedEnd > cursor) addSpan(cursor, paddedEnd - cursor);
  const medianPitch = [...notes].sort((a, b) => a.pitch - b.pitch)[Math.floor(notes.length / 2)].pitch;
  const clef = medianPitch < 60 ? '<sign>F</sign><line>4</line>' : '<sign>G</sign><line>2</line>';
  const measureXml = measures.map((items, index) => `<measure number="${index + 1}">${index === 0 ? `<attributes><divisions>${divisions}</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef>${clef}</clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>` : ''}${items.join('')}</measure>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><work><work-title>${escapeXml(title)}</work-title></work><identification><creator type="software">MP3 MIDI Tool</creator><encoding><software>MP3 MIDI Tool browser transcription</software></encoding></identification><part-list><score-part id="P1"><part-name>Transcribed melody</part-name></score-part></part-list><part id="P1">${measureXml}</part></score-partwise>`;
  return { xml, noteCount: notes.length, measureCount: measures.length };
}

function makeMidi(notes) {
  globalThis.Buffer ??= { from: (bytes) => new Uint8Array(bytes) };
  return generateFileData(notes);
}

function makeDownload(label, blob, filename, secondary = false) {
  const href = URL.createObjectURL(blob);
  objectUrls.push(href);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.textContent = label;
  if (secondary) link.className = 'secondary';
  scoreDownloads.append(link);
}

async function renderScore(xml) {
  scoreOutput.replaceChildren();
  const osmd = new OpenSheetMusicDisplay(scoreOutput, {
    autoResize: true,
    backend: 'svg',
    drawTitle: true,
    drawingParameters: 'default',
  });
  await osmd.load(xml);
  osmd.render();
  return scoreOutput.querySelectorAll('svg').length || 1;
}

async function convert() {
  if (!selectedFile) return;
  convertButton.disabled = true;
  result.hidden = true;
  scoreSection.hidden = true;
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
  const started = performance.now();
  try {
    const midiInput = isMidi(selectedFile);
    const notes = midiInput ? await midiToNotes(selectedFile) : await audioToNotes(selectedFile);
    setProgress(84, 'Building MusicXML…');
    const bpm = Math.max(40, Math.min(240, Number.parseInt(tempoInput.value, 10) || 120));
    tempoInput.value = String(bpm);
    const stem = selectedFile.name.replace(/\.(mp3|wav|mid|midi)$/i, '') || 'transcription';
    const { xml, noteCount: detectedNotes } = buildMusicXml(notes, bpm, stem);
    setProgress(91, 'Drawing the staff…');
    scoreSection.hidden = false;
    const pages = await renderScore(xml);
    const elapsed = (performance.now() - started) / 1000;
    noteCount.textContent = `${detectedNotes} ${detectedNotes === 1 ? 'note' : 'notes'}`;
    pageCount.textContent = `${pages} ${pages === 1 ? 'page' : 'pages'}`;
    elapsedTime.textContent = `${elapsed.toFixed(1)} seconds`;
    scoreDownloads.replaceChildren();
    makeDownload('Download MusicXML', new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }), `${stem}.musicxml`);
    const svgs = [...scoreOutput.querySelectorAll('svg')];
    if (svgs.length === 1) {
      const svgText = new XMLSerializer().serializeToString(svgs[0]);
      makeDownload('Download score SVG', new Blob([svgText], { type: 'image/svg+xml' }), `${stem}.svg`, true);
    }
    if (!midiInput) {
      const midiBytes = makeMidi(notes);
      if (midiBytes?.byteLength > 20) makeDownload('Download MIDI', new Blob([midiBytes], { type: 'audio/midi' }), `${stem}.mid`, true);
    }
    setProgress(100, 'Sheet music ready.');
    showResult(`Done — ${detectedNotes} notes rendered across ${pages} ${pages === 1 ? 'page' : 'pages'} in ${elapsed.toFixed(1)} seconds.`, 'success');
    scoreSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);
    progressWrap.hidden = true;
    showResult(error instanceof Error ? error.message : 'The sheet music could not be created.', 'error');
  } finally {
    convertButton.disabled = !selectedFile;
  }
}

fileInput.addEventListener('change', (event) => setFile(event.target.files?.[0]));
convertButton.addEventListener('click', convert);
['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', (event) => setFile(event.dataTransfer?.files?.[0]));
