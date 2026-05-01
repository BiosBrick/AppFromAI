import * as Clipboard from 'expo-clipboard';

export function createClipboardCapability() {
  return {
    async set(text: string): Promise<void> {
      await Clipboard.setStringAsync(text);
    },
    async get(): Promise<string> {
      return Clipboard.getStringAsync();
    },
  };
}
