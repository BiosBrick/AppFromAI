import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { generateModule } from '../../src/ai/aiClient';
import { saveModule } from '../../src/modules/moduleStore';
import { useSettings } from '../../src/settings/SettingsContext';
import { useI18n } from '../../src/i18n/useI18n';
import { GeneratingModal } from '../../src/components/GeneratingModal';

/* ── Design tokens ── */
const C = {
  bg: '#07101f',
  surface: '#111d30',
  surfaceHigh: '#1a2c45',
  border: '#1e3352',
  borderFocus: '#6366f1',
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  text: '#e2eaf6',
  muted: '#6a87ae',
  faint: '#2d4464',
  error: '#f87171',
  errorBg: '#180808',
  errorBorder: '#6b1a1a',
  success: '#34d399',
  successBg: '#03180f',
  successBorder: '#065f46',
};

// ── Main screen ─────────────────────────────────────────────────────────────
export default function GeneraScreen() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generationDone, setGenerationDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.55, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const onGenerate = async () => {
    if (!prompt.trim()) {
      setError(t.errorEmpty);
      return;
    }
    setError(null);
    setSuccess(false);
    setGenerationDone(false);
    setLoading(true);
    startPulse();
    try {
      const res = await generateModule(prompt.trim(), {
        useMock: false,
        language: settings.language || undefined,
        ...(settings.provider === 'ollama'
          ? {
              ollamaBaseUrl: settings.ollamaUrl || undefined,
              ollamaModel: settings.ollamaModel || undefined,
            }
          : settings.provider === 'claude'
          ? {
              apiProvider: 'claude',
              claudeBaseUrl: settings.claudeBaseUrl || undefined,
              claudeApiKey: settings.claudeApiKey || undefined,
              claudeModel: settings.claudeModel || 'claude-sonnet-4-20250514',
            }
          : {
              apiUrl: settings.openaiUrl || undefined,
              apiKey: settings.openaiKey || undefined,
              apiModel: settings.openaiModel || undefined,
            }),
      });
      if (!res.ok) {
        setError(t.humanizeError(res.error));
        return;
      }
      const saved = await saveModule(res.data, prompt.trim());
      if (!saved.ok) {
        setError(t.humanizeError(saved.error));
        return;
      }
      setGenerationDone(true);
      // Brief pause showing all steps done, then close modal
      await new Promise<void>((r) => setTimeout(r, 1200));
      setPrompt('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } finally {
      setLoading(false);
      setGenerationDone(false);
      stopPulse();
    }
  };

  const providerLabel =
    settings.provider === 'ollama'
      ? settings.ollamaModel || 'Ollama'
      : settings.provider === 'claude'
      ? settings.claudeModel || 'Claude'
      : settings.openaiModel || 'OpenAI';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* ── Loading overlay ── */}
      <GeneratingModal
        visible={loading}
        done={generationDone}
        prompt={prompt}
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand header ── */}
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <Animated.View style={[s.orb, { opacity: loading ? pulseAnim : 1 }]} />
              <Text style={s.brand}>AppFromAI</Text>
            </View>
            <View style={s.modelPill}>
              <View style={s.modelDot} />
              <Text style={s.modelText}>{providerLabel}</Text>
            </View>
          </View>

          {/* ── Hero headline ── */}
          <View style={s.hero}>
            <Text style={s.heroLine1}>{t.heroLine1}</Text>
            <View style={s.heroLine2Row}>
              <Text style={s.heroLine2}>{t.heroLine2}</Text>
              <View style={s.heroAccent}>
                <Text style={s.heroAccentText}>AI</Text>
              </View>
            </View>
            <Text style={s.heroSub}>{t.heroSub}</Text>
          </View>

          {/* ── Prompt area ── */}
          <View style={s.promptOuter}>
            <View style={[s.promptBox, focused && s.promptBoxFocused]}>
              <View style={s.cornerTL} />
              <View style={s.cornerBR} />
              <TextInput
                style={s.promptInput}
                placeholder={t.placeholder}
                placeholderTextColor={C.faint}
                value={prompt}
                onChangeText={(text) => {
                  setPrompt(text);
                  if (error) setError(null);
                  if (success) setSuccess(false);
                }}
                multiline
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                editable={!loading}
                autoCorrect={false}
              />
              <View style={s.promptToolbar}>
                <Text style={s.charCount}>{t.charCount(prompt.length)}</Text>
                {prompt.length > 0 && !loading ? (
                  <Pressable onPress={() => setPrompt('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={C.muted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <View style={s.examples}>
            {t.examples.map((example, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [s.exampleChip, pressed && s.exampleChipPressed]}
                onPress={() => {
                  setPrompt(example);
                  setError(null);
                  setSuccess(false);
                }}
                disabled={loading}
              >
                <Text style={s.exampleIndex}>{index + 1}</Text>
                <Text style={s.exampleText}>{example}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── Feedback ── */}
          {error ? (
            <View style={s.feedbackBox}>
              <View style={[s.feedbackInner, s.feedbackError]}>
                <Ionicons name="alert-circle" size={18} color={C.error} style={{ marginTop: 1 }} />
                <Text style={s.feedbackMsg}>{error}</Text>
              </View>
            </View>
          ) : success ? (
            <View style={s.feedbackBox}>
              <View style={[s.feedbackInner, s.feedbackSuccess]}>
                <Ionicons name="checkmark-circle" size={18} color={C.success} style={{ marginTop: 1 }} />
                <View style={s.feedbackText}>
                  <Text style={[s.feedbackMsg, { color: C.success }]}>{t.successTitle}</Text>
                  <Text style={s.feedbackHint}>{t.successHint}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={s.spacer} />
        </ScrollView>

        {/* ── CTA ── */}
        <View style={s.footer}>
          <Pressable
            style={({ pressed }) => [
              s.btn,
              loading && s.btnLoading,
              pressed && !loading && s.btnPressed,
            ]}
            disabled={loading}
            onPress={onGenerate}
          >
            <View style={s.btnInner}>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={s.btnText}>{loading ? t.btnGenerating : t.btnGenerate}</Text>
              {!loading && (
                <View style={s.btnArrow}>
                  <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.6)" />
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Main screen styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  brand: { color: C.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  modelDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  modelText: { color: C.muted, fontSize: 12, fontWeight: '600' },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 6,
  },
  heroLine1: { fontSize: 36, fontWeight: '300', color: C.muted, letterSpacing: -1 },
  heroLine2Row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroLine2: { fontSize: 48, fontWeight: '900', color: C.text, letterSpacing: -2 },
  heroAccent: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  heroAccentText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  heroSub: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 4 },

  promptOuter: { paddingHorizontal: 20 },
  promptBox: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    minHeight: 160,
    position: 'relative',
    overflow: 'hidden',
  },
  promptBoxFocused: { borderColor: C.borderFocus },
  cornerTL: {
    position: 'absolute', top: 0, left: 0, width: 24, height: 24,
    borderTopLeftRadius: 20, borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: C.primary, opacity: 0.4,
  },
  cornerBR: {
    position: 'absolute', bottom: 0, right: 0, width: 24, height: 24,
    borderBottomRightRadius: 20, borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: C.primary, opacity: 0.4,
  },
  promptInput: {
    padding: 18,
    paddingBottom: 8,
    color: C.text,
    fontSize: 16,
    lineHeight: 26,
    minHeight: 130,
    textAlignVertical: 'top',
  },
  promptToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  charCount: { color: C.faint, fontSize: 11, fontVariant: ['tabular-nums'] },

  examples: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  exampleChipPressed: { backgroundColor: C.surfaceHigh, borderColor: C.borderFocus },
  exampleIndex: {
    width: 22, height: 22, borderRadius: 11, overflow: 'hidden',
    backgroundColor: C.primary, color: '#fff', textAlign: 'center',
    lineHeight: 22, fontSize: 12, fontWeight: '900',
  },
  exampleText: { flex: 1, color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  feedbackBox: { paddingHorizontal: 20, paddingTop: 12 },
  feedbackInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  feedbackError: { backgroundColor: C.errorBg, borderColor: C.errorBorder },
  feedbackSuccess: { backgroundColor: C.successBg, borderColor: C.successBorder },
  feedbackText: { flex: 1, gap: 4 },
  feedbackMsg: { flex: 1, color: C.error, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  feedbackHint: { color: C.muted, fontSize: 12, lineHeight: 17 },

  spacer: { height: 20 },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnLoading: { opacity: 0.65, shadowOpacity: 0 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2, flex: 1 },
  btnArrow: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 4 },
});
