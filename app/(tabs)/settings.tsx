import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../src/settings/SettingsContext';
import { useI18n } from '../../src/i18n/useI18n';
import { LANGUAGES, type Language } from '../../src/i18n/translations';

const C = {
  bg: '#0b1120',
  surface: '#1a2236',
  surfaceHigh: '#22304a',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
  faint: '#3d5070',
};

/* ── Reusable Section wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={s.sectionBox}>{children}</View>
    </View>
  );
}

/* ── Single settings row ── */
function Row({
  label,
  hint,
  last,
  children,
}: {
  label: string;
  hint?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.row, !last && s.rowDivider]}>
      <View style={s.rowLabels}>
        <Text style={s.rowLabel}>{label}</Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/* ── Provider radio button ── */
function ProviderOption({
  value,
  current,
  label,
  hint,
  onSelect,
  last,
}: {
  value: 'ollama' | 'openai' | 'claude';
  current: 'ollama' | 'openai' | 'claude';
  label: string;
  hint: string;
  onSelect: () => void;
  last?: boolean;
}) {
  const active = value === current;
  return (
    <Pressable style={[s.row, !last && s.rowDivider]} onPress={onSelect}>
      <View style={s.rowLabels}>
        <Text style={[s.rowLabel, active && s.rowLabelActive]}>{label}</Text>
        <Text style={s.rowHint}>{hint}</Text>
      </View>
      <View style={[s.radio, active && s.radioActive]}>
        {active ? <View style={s.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

/* ── Language option ── */
function LangOption({
  code,
  label,
  flag,
  current,
  onSelect,
  last,
}: {
  code: string;
  label: string;
  flag: string;
  current: string;
  onSelect: () => void;
  last?: boolean;
}) {
  const active = code === current;
  return (
    <Pressable style={[s.row, !last && s.rowDivider]} onPress={onSelect}>
      <View style={s.rowLabels}>
        <Text style={[s.rowLabel, active && s.rowLabelActive]}>{flag}  {label}</Text>
      </View>
      <View style={[s.radio, active && s.radioActive]}>
        {active ? <View style={s.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();

  const currentLang = settings.language || '';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Page header */}
      <View style={s.header}>
        <Ionicons name="settings" size={20} color={C.primary} />
        <Text style={s.h1}>{t.settingsTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Language ── */}
        <Section title={t.sectionLanguage}>
          <LangOption
            code=""
            label={t.langAuto}
            flag="🌐"
            current={currentLang}
            onSelect={() => updateSettings({ language: '' })}
          />
          {LANGUAGES.map((lang, idx) => (
            <LangOption
              key={lang.code}
              code={lang.code}
              label={lang.label}
              flag={lang.flag}
              current={currentLang}
              onSelect={() => updateSettings({ language: lang.code as Language })}
              last={idx === LANGUAGES.length - 1}
            />
          ))}
        </Section>

        {/* ── Modalità ── */}
        <Section title={t.sectionMode}>
          <Row
            label={t.mockLabel}
            hint={t.mockHint}
            last
          >
            <Switch
              value={settings.useMock}
              onValueChange={(v) => updateSettings({ useMock: v })}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </Row>
        </Section>

        {/* ── Provider (hidden when mock is on) ── */}
        {!settings.useMock ? (
          <>
            <Section title={t.sectionProvider}>
              <ProviderOption
                value="ollama"
                current={settings.provider}
                label="Ollama"
                hint={t.providerOllamaHint}
                onSelect={() => updateSettings({ provider: 'ollama' })}
              />
              <ProviderOption
                value="openai"
                current={settings.provider}
                label="OpenAI API"
                hint={t.providerOpenAiHint}
                onSelect={() => updateSettings({ provider: 'openai' })}
              />
              <ProviderOption
                value="claude"
                current={settings.provider}
                label="Claude API"
                hint={t.providerClaudeHint}
                onSelect={() => updateSettings({ provider: 'claude' })}
                last
              />
            </Section>

            {/* ── Ollama config ── */}
            {settings.provider === 'ollama' ? (
              <Section title={t.sectionOllama}>
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t.ollamaUrlLabel}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={t.ollamaUrlPlaceholder}
                    placeholderTextColor={C.faint}
                    value={settings.ollamaUrl}
                    onChangeText={(v) => updateSettings({ ollamaUrl: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                  />
                  <Text style={s.inputHint}>{t.ollamaUrlHint}</Text>
                </View>
                <View style={s.sectionDivider} />
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t.ollamaModelLabel}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="gemma2:4b"
                    placeholderTextColor={C.faint}
                    value={settings.ollamaModel}
                    onChangeText={(v) => updateSettings({ ollamaModel: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  <Text style={s.inputHint}>{t.ollamaModelHint}</Text>
                </View>
              </Section>
            ) : null}

            {/* ── OpenAI config ── */}
            {settings.provider === 'openai' ? (
              <Section title={t.sectionOpenAi}>
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t.openAiUrlLabel}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    placeholderTextColor={C.faint}
                    value={settings.openaiUrl}
                    onChangeText={(v) => updateSettings({ openaiUrl: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                  />
                </View>
              </Section>
            ) : null}

            {/* ── Claude config ── */}
            {settings.provider === 'claude' ? (
              <Section title={t.sectionClaude}>
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t.claudeUrlLabel}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="https://api.anthropic.com/v1"
                    placeholderTextColor={C.faint}
                    value={settings.claudeBaseUrl}
                    onChangeText={(v) => updateSettings({ claudeBaseUrl: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                  />
                  <Text style={s.inputHint}>{t.claudeUrlHint}</Text>
                </View>
                <View style={s.sectionDivider} />
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t.claudeKeyLabel}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="sk-ant-..."
                    placeholderTextColor={C.faint}
                    value={settings.claudeApiKey}
                    onChangeText={(v) => updateSettings({ claudeApiKey: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    returnKeyType="done"
                  />
                </View>
                <View style={s.sectionDivider} />
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t.claudeModelLabel}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="claude-sonnet-4-20250514"
                    placeholderTextColor={C.faint}
                    value={settings.claudeModel}
                    onChangeText={(v) => updateSettings({ claudeModel: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>
              </Section>
            ) : null}
          </>
        ) : null}

        {/* ── Info ── */}
        <Section title={t.sectionInfo}>
          <Row label={t.appVersionLabel} last>
            <Text style={s.valueText}>1.0.0</Text>
          </Row>
        </Section>

        {/* Security notice */}
        <View style={s.notice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.faint} />
          <Text style={s.noticeText}>{t.securityNotice}</Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
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
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginHorizontal: 16,
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
  rowLabelActive: { color: C.primary },
  rowHint: { color: C.muted, fontSize: 12, lineHeight: 17 },
  valueText: { color: C.muted, fontSize: 14 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },

  inputGroup: { padding: 16, gap: 8 },
  inputLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputHint: { color: C.faint, fontSize: 11, lineHeight: 16 },
  inputHintMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: C.muted,
  },

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
});
