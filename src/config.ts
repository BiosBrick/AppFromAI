/**
 * Abilita api.network.fetch per i moduli (default: disattivato).
 * Imposta EXPO_PUBLIC_ENABLE_MODULE_NETWORK=true in .env per la build.
 */
export function isModuleNetworkFetchEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_MODULE_NETWORK === 'true';
}

/** Base URL Ollama senza slash finale (es. http://192.168.1.10:11434). */
export function getDefaultOllamaBaseUrl(): string {
  const u = process.env.EXPO_PUBLIC_OLLAMA_URL?.trim().replace(/\/$/, '');
  return u || 'http://localhost:11434';
}

/** Nome modello come in `ollama list` (es. gemma2:4b). */
export function getDefaultOllamaModel(): string {
  const m = process.env.EXPO_PUBLIC_OLLAMA_MODEL?.trim();
  return m || 'gemma4e4';
}
