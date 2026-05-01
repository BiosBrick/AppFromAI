import { Audio } from 'expo-av';
import type { CapabilityRegistry } from './capabilityRegistry';

export function createAudioRecorderCapability(registry: CapabilityRegistry) {
  let active: Audio.Recording | null = null;

  const forceStop = async () => {
    if (!active) return;
    const rec = active;
    active = null;
    registry.unregister('audioRecorder');
    try { await rec.stopAndUnloadAsync(); } catch { /* ignora */ }
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch { /* ignora */ }
  };

  return {
    async start() {
      if (active) throw new Error('Registrazione già attiva');
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Permesso microfono negato');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      active = recording;
      registry.register('audioRecorder', forceStop);
    },

    async stop(): Promise<{ uri: string; durationMs?: number } | null> {
      if (!active) return null;
      const rec = active;
      active = null;
      registry.unregister('audioRecorder');
      try {
        const uri = rec.getURI();
        await rec.stopAndUnloadAsync();
        const status = await rec.getStatusAsync().catch(() => null);
        const durationMs =
          status && 'durationMillis' in status ? (status.durationMillis as number | undefined) : undefined;
        if (!uri) return null;
        return { uri, durationMs };
      } finally {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      }
    },
  };
}
