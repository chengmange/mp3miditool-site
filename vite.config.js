import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        wavToMidi: resolve(import.meta.dirname, 'wav-to-midi/index.html'),
        midiToMp3: resolve(import.meta.dirname, 'midi-to-mp3/index.html'),
        audioToSheetMusic: resolve(import.meta.dirname, 'audio-to-sheet-music/index.html'),
        midiToSheetMusic: resolve(import.meta.dirname, 'midi-to-sheet-music/index.html'),
      },
    },
  },
});
