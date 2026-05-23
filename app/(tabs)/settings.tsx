import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../../src/settings/SettingsContext';
import { useI18n } from '../../src/i18n/useI18n';
import { LANGUAGES, type Language } from '../../src/i18n/translations';

const C = {
  bg: '#0b1120',
  surface: '#1a2236',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
  faint: '#3d5070',
  success: '#34d399',
  overlay: 'rgba(0,0,0,0.7)',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={s.sectionBox}>{children}</View>
    </View>
  );
}

function NavRow({
  label,
  hint,
  active,
  last,
  onPress,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.row, !last && s.rowDivider]} onPress={onPress}>
      <View style={s.rowLabels}>
        <Text style={s.rowLabel}>{label}</Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      <View style={s.rowRight}>
        {active ? (
          <View style={s.activeDot} />
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={C.muted} />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const router = useRouter();
  const [langModal, setLangModal] = useState(false);

  const currentLang = settings.language || '';
  const currentLangObj = LANGUAGES.find((l) => l.code === currentLang);
  const langLabel = currentLangObj
    ? `${currentLangObj.flag}  ${currentLangObj.label}`
    : '🌐  Auto';

  const providerHint = (p: 'ollama' | 'openai' | 'claude') => {
    if (p === 'ollama') return settings.ollamaUrl || 'Non configurato';
    if (p === 'openai') return settings.openaiUrl || 'Non configurato';
    return settings.claudeModel || 'Non configurato';
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={s.header}>
        <Ionicons name="settings" size={20} color={C.primary} />
        <Text style={s.h1}>{t.settingsTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Language ── */}
        <Section title={t.sectionLanguage}>
          <Pressable style={s.row} onPress={() => setLangModal(true)}>
            <Text style={s.rowLabel}>{langLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        </Section>

        {/* ── Provider ── */}
        <Section title={t.sectionProvider}>
          <NavRow
            label="Ollama"
            hint={providerHint('ollama')}
            active={settings.provider === 'ollama'}
            onPress={() => router.push('/settings/ollama')}
          />
          <NavRow
            label="OpenAI / Compatible"
            hint={providerHint('openai')}
            active={settings.provider === 'openai'}
            onPress={() => router.push('/settings/openai')}
          />
          <NavRow
            label="Claude"
            hint={providerHint('claude')}
            active={settings.provider === 'claude'}
            last
            onPress={() => router.push('/settings/claude')}
          />
        </Section>

        {/* ── Info ── */}
        <Section title={t.sectionInfo}>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t.appVersionLabel}</Text>
            <Text style={s.valueText}>1.0.0</Text>
          </View>
        </Section>

        <View style={s.notice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.faint} />
          <Text style={s.noticeText}>{t.securityNotice}</Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Language picker modal ── */}
      <Modal
        visible={langModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModal(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setLangModal(false)}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>{t.sectionLanguage}</Text>

            {/* Auto */}
            <Pressable
              style={[s.langRow, currentLang === '' && s.langRowActive]}
              onPress={() => { updateSettings({ language: '' }); setLangModal(false); }}
            >
              <Text style={s.langRowText}>🌐  Auto</Text>
              {currentLang === '' && <Ionicons name="checkmark" size={18} color={C.primary} />}
            </Pressable>

            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                style={[s.langRow, currentLang === lang.code && s.langRowActive]}
                onPress={() => { updateSettings({ language: lang.code as Language }); setLangModal(false); }}
              >
                <Text style={s.langRowText}>{lang.flag}  {lang.label}</Text>
                {currentLang === lang.code && <Ionicons name="checkmark" size={18} color={C.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  h1: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  scroll: { padding: 16, gap: 20, paddingBottom: 32 },

  section: { gap: 7 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.faint,
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  sectionBox: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  rowLabels: { flex: 1, gap: 2 },
  rowLabel: { color: C.text, fontSize: 15, fontWeight: '500' },
  rowHint: { color: C.muted, fontSize: 12, lineHeight: 17 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  valueText: { color: C.muted, fontSize: 14 },

  notice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, color: C.faint, fontSize: 12, lineHeight: 18 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.faint,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  langRowActive: { backgroundColor: C.primary + '18' },
  langRowText: { fontSize: 16, color: C.text },
});
