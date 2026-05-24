import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { LocalLlm } = NativeModules;

export type ModelEntry = {
  id: string;
  name: string;
  description: string;
  sizeBytes: number;
  downloadUrl: string;
  localFile: string;
  /** True if the HuggingFace repo requires license acceptance + HF token */
  gated?: boolean;
};

/** Static catalog — mirrors Kotlin CATALOG, always available for display. */
export const MODEL_CATALOG: ModelEntry[] = [
  {
    id: 'gemma4-appfromai',
    name: 'Gemma 4 E2B AppFromAI ★★',
    description: 'Gemma 4 E2B fine-tunato su AppFromAI. Genera moduli corretti senza prompt lungo, context 32K. ~2.4 GB. Consigliato.',
    sizeBytes: 2_588_147_712,
    // TODO: sostituisci con l'URL del tuo .litertlm dopo il fine-tuning su Colab/Kaggle
    downloadUrl: 'https://huggingface.co/PLACEHOLDER/gemma4-appfromai/resolve/main/gemma4_appfromai.litertlm',
    localFile: 'gemma4-appfromai.litertlm',
  },
  {
    id: 'gemma4-e2b',
    name: 'Gemma 4 E2B IT',
    description: 'Google Gemma 4 E2B base, architettura ibrida, context 32K. ~2.4 GB.',
    sizeBytes: 2_588_147_712,
    downloadUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm',
    localFile: 'gemma4-e2b.litertlm',
  },
  {
    id: 'gemma4-e4b',
    name: 'Gemma 4 E4B IT',
    description: 'Google Gemma 4 E4B base, versione più grande, context 32K. ~3.4 GB.',
    sizeBytes: 3_659_530_240,
    downloadUrl: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm',
    localFile: 'gemma4-e4b.litertlm',
  },
];

export type DownloadedModel = {
  id: string;
  path: string;
  sizeBytes: number;
};

export type DownloadProgressEvent = {
  modelId: string;
  percent: number;
  downloaded: number;
  total: number;
};

const isSupported = Platform.OS === 'android' && !!LocalLlm;

function assertSupported(): void {
  if (!isSupported) {
    throw new Error('Local LLM is only available on Android after a native build (expo run:android).');
  }
}

export const LocalLlmModule = {
  isSupported,

  getAvailableModels(): Promise<ModelEntry[]> {
    assertSupported();
    return LocalLlm.getAvailableModels();
  },

  getDownloadedModels(): Promise<DownloadedModel[]> {
    assertSupported();
    return LocalLlm.getDownloadedModels();
  },

  getLoadedModelId(): Promise<string | null> {
    assertSupported();
    return LocalLlm.getLoadedModelId();
  },

  downloadModel(modelId: string, hfToken?: string): Promise<string> {
    assertSupported();
    return LocalLlm.downloadModel(modelId, hfToken ?? null);
  },

  cancelDownload(modelId: string): void {
    assertSupported();
    LocalLlm.cancelDownload(modelId);
  },

  deleteModel(modelId: string): Promise<void> {
    assertSupported();
    return LocalLlm.deleteModel(modelId);
  },

  loadModel(modelId: string): Promise<void> {
    assertSupported();
    return LocalLlm.loadModel(modelId);
  },

  generateText(prompt: string): Promise<string> {
    assertSupported();
    return LocalLlm.generateText(prompt);
  },

  addDownloadProgressListener(
    callback: (event: DownloadProgressEvent) => void
  ): () => void {
    if (!isSupported) return () => {};
    const emitter = new NativeEventEmitter(LocalLlm);
    const sub = emitter.addListener('LocalLlmDownloadProgress', callback);
    return () => sub.remove();
  },
};
