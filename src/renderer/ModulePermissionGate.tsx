import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MotherPermission } from '../types/generatedModule';
import { describePermissionsForUi } from '../security/permissions';
import { useI18n } from '../i18n/useI18n';

const C = {
  bg: '#0b1120',
  surface: '#1a2236',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
  faint: '#3d5070',
  error: '#f87171',
};

const PERM_ICON: Record<string, string> = {
  camera: '📷',
  audioRecorder: '🎙️',
  qrScanner: '📷',
  torch: '🔦',
  location: '📍',
  sensors: '🧭',
  linking: '🔗',
  storage: '💾',
  network: '🌐',
  notifications: '🔔',
};

type Props = {
  permissions: MotherPermission[];
  onAllow: () => void;
  onDeny: () => void;
  busy?: boolean;
};

export function ModulePermissionGate({ permissions, onAllow, onDeny, busy = false }: Props) {
  const { t } = useI18n();
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.iconRow}>
        <View style={styles.iconWrapper}>
          <Ionicons name="shield-checkmark-outline" size={36} color={C.primary} />
        </View>
      </View>

      <Text style={styles.title}>{t.permTitle}</Text>
      <Text style={styles.body}>
        {t.permBody(describePermissionsForUi(permissions))}{'\n\n'}
        {t.permNotice}
      </Text>

      {/* Permission list */}
      <View style={styles.permList}>
        {permissions.map((p) => (
          <View key={p} style={styles.permRow}>
            <Text style={styles.permIcon}>{PERM_ICON[p] ?? '•'}</Text>
            <View>
              <Text style={styles.permName}>{p}</Text>
            </View>
          </View>
        ))}
      </View>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={C.primary} size="small" />
          <Text style={styles.busyText}>{t.permRequesting}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.btnAllow, busy && styles.btnDisabled, pressed && !busy && styles.btnPressed]}
        onPress={onAllow}
        disabled={busy}
      >
        <Ionicons name="checkmark" size={18} color="#fff" />
        <Text style={styles.btnAllowText}>{t.permAllow}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btnDeny, busy && styles.btnDisabled, pressed && !busy && { opacity: 0.7 }]}
        onPress={onDeny}
        disabled={busy}
      >
        <Text style={styles.btnDenyText}>{t.permDeny}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 18 },

  iconRow: { alignItems: 'center' },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#312e81',
  },

  title: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -0.4 },
  body: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' },

  permList: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  permIcon: { fontSize: 20 },
  permName: { color: C.text, fontSize: 15, fontWeight: '500', textTransform: 'capitalize' },

  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  busyText: { color: C.muted, flex: 1, fontSize: 13 },

  btnAllow: {
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnAllowText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  btnDeny: { paddingVertical: 14, alignItems: 'center' },
  btnDenyText: { color: C.muted, fontSize: 15, fontWeight: '500' },
});
