import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import type { CapabilityRegistry } from './capabilityRegistry';

export function createAudioPlayerCapability(registry: CapabilityRegistry) {
  let sound: AudioPlayer | null = null;
  let playbackSubscription: { remove: () => void } | null = null;

  const stopAndUnload = async () => {
    if (!sound) return;
    const s = sound;
    sound = null;
    playbackSubscription?.remove();
    playbackSubscription = null;
    try { s.pause(); } catch { /* già fermato */ }
    try { s.remove(); } catch { /* già scaricato */ }
    registry.unregister('audioPlayer');
  };

  return {
    async play(uri: string): Promise<{ durationMs?: number }> {
      await stopAndUnload();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      const s = createAudioPlayer(uri);
      sound = s;
      registry.register('audioPlayer', stopAndUnload);

      playbackSubscription = s.addListener('playbackStatusUpdate', (st) => {
        if (st.isLoaded && st.didJustFinish) {
          void stopAndUnload();
        }
      });

      s.play();
      const status = s.currentStatus;
      return {
        durationMs: status.isLoaded && status.duration ? Math.round(status.duration * 1000) : undefined,
      };
    },

    async stop(): Promise<void> {
      await stopAndUnload();
    },

    async pause(): Promise<void> {
      if (sound) {
        try { sound.pause(); } catch { /* ignora */ }
      }
    },

    async resume(): Promise<void> {
      if (sound) {
        try { sound.play(); } catch { /* ignora */ }
      }
    },

    async getStatus(): Promise<{ isPlaying: boolean; positionMs?: number; durationMs?: number }> {
      if (!sound) return { isPlaying: false };
      const st = sound.currentStatus;
      if (!st.isLoaded) return { isPlaying: false };
      return {
        isPlaying: st.playing,
        positionMs: Math.round(st.currentTime * 1000),
        durationMs: st.duration ? Math.round(st.duration * 1000) : undefined,
      };
    },
  };
}
