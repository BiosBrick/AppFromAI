import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';

export function createShareCapability() {
  return {
    async text(message: string, title?: string): Promise<{ shared: boolean }> {
      try {
        const result = await Share.share({ message, title });
        return { shared: result.action !== Share.dismissedAction };
      } catch {
        return { shared: false };
      }
    },
    async file(uri: string, message?: string): Promise<{ shared: boolean }> {
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          if (message) await Share.share({ message });
          return { shared: false };
        }
        await Sharing.shareAsync(uri, { dialogTitle: message });
        return { shared: true };
      } catch {
        return { shared: false };
      }
    },
  };
}
