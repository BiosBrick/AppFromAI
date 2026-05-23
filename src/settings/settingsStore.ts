import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDefaultOllamaBaseUrl, getDefaultOllamaModel } from '../config';

const KEY = 'afi:settings:v1';

export type AppSettings = {
  provider: 'ollama' | 'openai' | 'claude';
  ollamaUrl: string;
  ollamaModel: string;
  openaiUrl: string;
  openaiKey: string;
  openaiModel: string;
  claudeBaseUrl: string;
  claudeApiKey: string;
  claudeModel: string;
  /** '' = auto-detect from system locale */
  language: string;
};

export function defaultSettings(): AppSettings {
  return {
    provider: 'ollama',
    ollamaUrl: getDefaultOllamaBaseUrl(),
    ollamaModel: getDefaultOllamaModel(),
    openaiUrl: '',
    openaiKey: '',
    openaiModel: 'gpt-4o-mini',
    claudeBaseUrl: 'https://api.anthropic.com/v1',
    claudeApiKey: '',
    claudeModel: 'claude-sonnet-4-20250514',
    language: '',
  };
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const loaded = { ...defaultSettings(), ...(JSON.parse(raw) as Partial<AppSettings>) };
      // Se il provider salvato è uno rimosso, resetta a ollama
      if (!['ollama', 'openai', 'claude'].includes(loaded.provider)) {
        loaded.provider = 'ollama';
      }
      return loaded;
    }
  } catch {
    // ignore read errors
  }
  return defaultSettings();
}

export async function persistSettings(s: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore write errors
  }
}
