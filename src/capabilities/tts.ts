import * as Speech from 'expo-speech';
import type { CapabilityRegistry } from './capabilityRegistry';

export function createTtsCapability(registry: CapabilityRegistry) {
  const REGISTRY_KEY = 'tts';

  return {
    async speak(
      text: string,
      opts?: { language?: string; pitch?: number; rate?: number }
    ): Promise<void> {
      Speech.stop();
      registry.register(REGISTRY_KEY, () => Speech.stop());
      await new Promise<void>((resolve) => {
        Speech.speak(text, {
          language: opts?.language,
          pitch: opts?.pitch,
          rate: opts?.rate,
          onDone: () => { registry.unregister(REGISTRY_KEY); resolve(); },
          onError: () => { registry.unregister(REGISTRY_KEY); resolve(); },
          onStopped: () => { registry.unregister(REGISTRY_KEY); resolve(); },
        });
      });
    },
    async stop(): Promise<void> {
      Speech.stop();
      registry.unregister(REGISTRY_KEY);
    },
    async isSpeaking(): Promise<boolean> {
      return Speech.isSpeakingAsync();
    },
  };
}
