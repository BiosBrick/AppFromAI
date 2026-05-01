import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import type { MotherPermission } from '../types/generatedModule';

/**
 * Richiede al sistema i permessi nativi coerenti con il manifest (best-effort).
 * Non lancia mai: raccoglie avvisi (es. notifiche non disponibili su web / Expo Go).
 */
export async function prefetchNativePermissions(perms: MotherPermission[]): Promise<string[]> {
  const warnings: string[] = [];
  const set = new Set(perms);

  if (set.has('audioRecorder')) {
    try {
      const r = await Audio.requestPermissionsAsync();
      if (!r.granted) {
        warnings.push('Microfono: permesso non concesso (il registratore potrebbe fallire).');
      }
    } catch (e) {
      warnings.push(`Microfono: ${(e as Error).message}`);
    }
  }

  if (set.has('camera') || set.has('qrScanner') || set.has('torch')) {
    try {
      const r = await Camera.requestCameraPermissionsAsync();
      if (!r.granted) {
        warnings.push(
          'Fotocamera: permesso non concesso (foto / scanner QR / torcia potrebbero non funzionare).'
        );
      }
    } catch (e) {
      warnings.push(`Fotocamera: ${(e as Error).message}`);
    }
  }

  if (set.has('location')) {
    try {
      const r = await Location.requestForegroundPermissionsAsync();
      if (!r.granted) {
        warnings.push('Posizione: permesso non concesso (GPS/localizzazione potrebbe fallire).');
      }
    } catch (e) {
      warnings.push(`Posizione: ${(e as Error).message}`);
    }
  }

  if (set.has('notifications')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const N = require('expo-notifications') as typeof import('expo-notifications');
      await N.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
        android: {},
      });
    } catch {
      // Expo Go SDK 53+ non supporta notifiche push remote — ignora silenziosamente.
    }
  }

  // storage / network: nessun dialog di sistema dedicato qui
  if (
    Platform.OS === 'web' &&
    (set.has('audioRecorder') ||
      set.has('camera') ||
      set.has('qrScanner') ||
      set.has('torch') ||
      set.has('location') ||
      set.has('sensors'))
  ) {
    warnings.push('Su web microfono/fotocamera/posizione/sensori possono non essere supportati.');
  }

  return warnings;
}
