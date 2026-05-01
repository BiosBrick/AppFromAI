import type { GeneratedModulePayload } from '../types/generatedModule';

/** Risposte mock per test offline e CI. */
export const MOCK_CALCULATOR: GeneratedModulePayload = {
  manifest: {
    id: 'calculator-mock',
    name: 'Calcolatrice (mock)',
    version: '1.0.0',
    runtime: 'javascript',
    permissions: [],
    entry: 'logic.js',
    ui: 'ui.json',
  },
  ui: {
    type: 'screen',
    title: 'Calcolatrice',
    components: [
      {
        type: 'text',
        id: 'display',
        text: '0',
        bind: 'display',
      },
      {
        type: 'input',
        id: 'a',
        bind: 'a',
        placeholder: 'Primo numero',
        keyboardType: 'decimal-pad',
      },
      {
        type: 'input',
        id: 'b',
        bind: 'b',
        placeholder: 'Secondo numero',
        keyboardType: 'decimal-pad',
      },
      {
        type: 'button',
        id: 'add',
        text: 'Somma',
        action: 'add',
      },
      {
        type: 'button',
        id: 'clear',
        text: 'Azzera',
        action: 'clear',
      },
    ],
  },
  code: `
module.exports = {
  actions: {
    async add(api, input, state) {
      const a = parseFloat(String(state.a ?? '0').replace(',', '.')) || 0;
      const b = parseFloat(String(state.b ?? '0').replace(',', '.')) || 0;
      return { display: String(a + b) };
    },
    async clear(api, input, state) {
      return { display: '0', a: '', b: '' };
    },
  },
};
`,
};

export const MOCK_AUDIO_RECORDER: GeneratedModulePayload = {
  manifest: {
    id: 'audio-recorder-mock',
    name: 'Registratore audio (mock)',
    version: '1.0.0',
    runtime: 'javascript',
    permissions: ['audioRecorder', 'storage'],
    entry: 'logic.js',
    ui: 'ui.json',
  },
  ui: {
    type: 'screen',
    title: 'Registratore audio',
    components: [
      { type: 'text', id: 'status', text: 'Pronto', bind: 'status' },
      {
        type: 'button',
        id: 'start',
        text: 'Avvia registrazione',
        action: 'startRecording',
      },
      {
        type: 'button',
        id: 'stop',
        text: 'Ferma registrazione',
        action: 'stopRecording',
      },
    ],
  },
  code: `
module.exports = {
  actions: {
    async startRecording(api, input, state) {
      await api.audioRecorder.start();
      return { status: 'Registrazione avviata' };
    },
    async stopRecording(api, input, state) {
      const file = await api.audioRecorder.stop();
      if (file && file.uri) {
        await api.storage.save('lastRecording', file);
      }
      return { status: file ? 'Registrazione salvata' : 'Nessuna registrazione attiva' };
    },
  },
};
`,
};

export const MOCK_QR_READER: GeneratedModulePayload = {
  manifest: {
    id: 'qr-reader-mock',
    name: 'Lettore QR (mock)',
    version: '1.0.0',
    runtime: 'javascript',
    permissions: ['qrScanner', 'storage'],
    entry: 'logic.js',
    ui: 'ui.json',
  },
  ui: {
    type: 'screen',
    title: 'Lettore QR',
    components: [
      { type: 'text', id: 'last', text: 'Nessuna scansione', bind: 'lastScan' },
      {
        type: 'button',
        id: 'scan',
        text: 'Scansiona QR',
        action: 'scanOnce',
      },
    ],
  },
  code: `
module.exports = {
  actions: {
    async scanOnce(api, input, state) {
      const text = await api.qrScanner.scan();
      if (text) {
        await api.storage.save('lastQr', text);
      }
      return { lastScan: text || 'Nessun codice' };
    },
  },
};
`,
};

export const MOCK_NAVIGATOR: GeneratedModulePayload = {
  manifest: {
    id: 'navigator-mock',
    name: 'Demo navigazione (mock)',
    version: '1.0.0',
    runtime: 'javascript',
    permissions: [],
    entry: 'logic.js',
    ui: 'ui.json',
  },
  ui: {
    type: 'navigator',
    initialScreen: 'home',
    theme: { bg: '#0d0d0d', primary: '#f59e0b', text: '#f5f5f5', surface: '#1c1c1c', border: '#333', muted: '#888' },
    screens: {
      home: {
        type: 'screen',
        title: 'Home',
        components: [
          {
            type: 'button',
            id: 'btn-antonio',
            text: 'Antonio',
            navigate: 'seconda',
            style: { backgroundColor: '#FFD700', color: '#000000', fontWeight: '800', borderRadius: 20 },
          },
        ],
      },
      seconda: {
        type: 'screen',
        title: 'Seconda pagina',
        components: [
          { type: 'text', id: 'msg', text: 'ciao' },
        ],
      },
    },
  },
  code: `module.exports = { actions: {} };`,
};

export function pickMockModule(prompt: string): GeneratedModulePayload | null {
  const p = prompt.toLowerCase();
  if (p.includes('calcolatrice') || p.includes('calculator')) {
    return MOCK_CALCULATOR;
  }
  if (p.includes('audio') || p.includes('registr')) {
    return MOCK_AUDIO_RECORDER;
  }
  if (p.includes('qr') || p.includes('barcode')) {
    return MOCK_QR_READER;
  }
  if (
    p.includes('pag') ||
    p.includes('navig') ||
    p.includes('apre') ||
    p.includes('giallo') ||
    p.includes('colore') ||
    p.includes('antonio')
  ) {
    return MOCK_NAVIGATOR;
  }
  return null;
}
