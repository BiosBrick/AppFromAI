import { Audio } from 'expo-av';
import type { CapabilityRegistry } from './capabilityRegistry';

export function createAudioPlayerCapability(registry: CapabilityRegistry) {
  let sound: Audio.Sound | null = null;

  const stopAndUnload = async () => {
    if (!sound) return;
    const s = sound;
    sound = null;
    try { await s.stopAsync(); } catch { /* già fermato */ }
    try { await s.unloadAsync(); } catch { /* già scaricato */ }
    registry.unregister('audioPlayer');
  };

  return {
    async play(uri: string): Promise<{ durationMs?: number }> {
      await stopAndUnload();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      sound = s;
      registry.register('audioPlayer', stopAndUnload);

      s.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          void stopAndUnload();
        }
      });

      const status = await s.getStatusAsync();
      return {
        durationMs: status.isLoaded ? status.durationMillis : undefined,
      };
    },

    async stop(): Promise<void> {
      await stopAndUnload();
    },

    async pause(): Promise<void> {
      if (sound) {
        try { await sound.pauseAsync(); } catch { /* ignora */ }
      }
    },

    async resume(): Promise<void> {
      if (sound) {
        try { await sound.playAsync(); } catch { /* ignora */ }
      }
    },

    async getStatus(): Promise<{ isPlaying: boolean; positionMs?: number; durationMs?: number }> {
      if (!sound) return { isPlaying: false };
      const st = await sound.getStatusAsync().catch(() => null);
      if (!st || !st.isLoaded) return { isPlaying: false };
      return {
        isPlaying: st.isPlaying,
        positionMs: st.positionMillis,
        durationMs: st.durationMillis,
      };
    },
  };
}
