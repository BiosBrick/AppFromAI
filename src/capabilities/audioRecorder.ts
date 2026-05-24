import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';
import type { CapabilityRegistry } from './capabilityRegistry';

export function createAudioRecorderCapability(registry: CapabilityRegistry) {
  let active: AudioRecorder | null = null;

  const forceStop = async () => {
    if (!active) return;
    const rec = active;
    active = null;
    registry.unregister('audioRecorder');
    try { await rec.stop(); } catch { /* ignora */ }
    try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* ignora */ }
  };

  return {
    async start() {
      if (active) throw new Error('Registrazione già attiva');
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('Permesso microfono negato');
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recording.prepareToRecordAsync();
      recording.record();
      active = recording;
      registry.register('audioRecorder', forceStop);
    },

    async stop(): Promise<{ uri: string; durationMs?: number } | null> {
      if (!active) return null;
      const rec = active;
      active = null;
      registry.unregister('audioRecorder');
      try {
        await rec.stop();
        const status = rec.getStatus();
        const uri = status.url ?? rec.uri;
        const durationMs = status.durationMillis;
        if (!uri) return null;
        return { uri, durationMs };
      } finally {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    },
  };
}
