import { Platform } from 'react-native';

type ExpoNotifications = typeof import('expo-notifications');

let cached: ExpoNotifications | null | undefined;

function loadNotifications(): ExpoNotifications | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') {
    cached = null;
    return null;
  }
  try {
    // Caricamento lazy: l'import statico fallisce su web / build senza modulo nativo e blocca tutta motherApi.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as ExpoNotifications;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

let configured = false;

function ensureHandler(Notifications: ExpoNotifications) {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function createNotificationsCapability() {
  return {
    async schedule(title: string, body: string, secondsFromNow: number) {
      const Notifications = loadNotifications();
      if (!Notifications) {
        throw new Error(
          'Notifiche non disponibili in questo ambiente (web, client senza expo-notifications nativo, o modulo non caricato).'
        );
      }
      ensureHandler(Notifications);
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted) {
        const req = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
          android: {},
        });
        if (!req.granted) {
          throw new Error('Permesso notifiche negato');
        }
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.floor(secondsFromNow)),
        },
      });
      return id;
    },
  };
}
