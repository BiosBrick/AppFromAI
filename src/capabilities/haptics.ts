import * as Haptics from 'expo-haptics';

export function createHapticsCapability() {
  return {
    async impact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      } as const;
      await Haptics.impactAsync(map[style]);
    },
    async notification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
      const map = {
        success: Haptics.NotificationFeedbackType.Success,
        warning: Haptics.NotificationFeedbackType.Warning,
        error: Haptics.NotificationFeedbackType.Error,
      } as const;
      await Haptics.notificationAsync(map[type]);
    },
    async selection(): Promise<void> {
      await Haptics.selectionAsync();
    },
  };
}
