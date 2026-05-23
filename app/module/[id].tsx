import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { generateModule } from '../../src/ai/aiClient';
import { getModule, replaceModule } from '../../src/modules/moduleStore';
import { useSettings } from '../../src/settings/SettingsContext';
import type { MotherPermission } from '../../src/types/generatedModule';
import { CapabilityRegistry } from '../../src/capabilities/capabilityRegistry';
import { createMotherApi } from '../../src/capabilities/motherApi';
import { isModuleNetworkFetchEnabled } from '../../src/config';
import { DynamicRenderer } from '../../src/renderer/DynamicRenderer';
import { ModulePermissionGate } from '../../src/renderer/ModulePermissionGate';
import { prefetchNativePermissions } from '../../src/security/runtimePermissions';
import { useI18n } from '../../src/i18n/useI18n';
import { GeneratingModal } from '../../src/components/GeneratingModal';
import { StyleEditorSheet } from '../../src/components/StyleEditorSheet';
import { updateModuleStyle } from '../../src/modules/moduleStore';
import { applyColorChanges, applyTextChanges } from '../../src/modules/styleEditor';

const C = {
  bg: '#0b1120',
  surface: '#1a2236',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
  faint: '#3d5070',
  success: '#34d399',
  error: '#f87171',
  errorBg: '#180808',
  errorBorder: '#6b1a1a',
  overlay: 'rgba(0,0,0,0.7)',
};

export default function ModuleScreen() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [mod, setMod] = useState<Awaited<ReturnType<typeof getModule>>>(null);
  const [loading, setLoading] = useState(true);
  const [needsGate, setNeedsGate] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [grantedIds, setGrantedIds] = useState<MotherPermission[]>([]);
  const [gateBusy, setGateBusy] = useState(false);

  // ── Style editor state ────────────────────────────────────────────────────
  const [styleSheet, setStyleSheet] = useState(false);

  // ── Regen state ──────────────────────────────────────────────────────────
  const [regenSheet, setRegenSheet] = useState(false);
  const [tweakText, setTweakText] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenDone, setRegenDone] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const regenPromptRef = useRef('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const m = await getModule(id);
    setMod(m ?? null);
    const gate = Boolean(m && m.manifest.permissions.length > 0);
    setNeedsGate(gate);
    setAnswered(!gate);
    setGrantedIds([]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const registry = useMemo(() => new CapabilityRegistry(), [mod?.id]);
  useEffect(() => { return () => { void registry.cleanupAll(); }; }, [registry]);

  const onAllow = async () => {
    if (!mod || gateBusy) return;
    setGateBusy(true);
    try {
      await prefetchNativePermissions(mod.manifest.permissions);
    } finally {
      setGateBusy(false);
    }
    setGrantedIds([...mod.manifest.permissions]);
    setAnswered(true);
  };

  const onDeny = () => {
    setGrantedIds([]);
    setAnswered(true);
  };

  const motherApi = useMemo(() => {
    if (!mod) return null;
    return createMotherApi({
      moduleId: mod.id,
      manifestPermissions: mod.manifest.permissions,
      granted: new Set(grantedIds),
      allowNetworkFetch: isModuleNetworkFetchEnabled(),
      registry,
    });
  }, [mod, grantedIds, registry]);

  // ── Regen handler ─────────────────────────────────────────────────────────
  const onRegenConfirm = async () => {
    if (!mod || !id) return;
    const originalPrompt = mod.prompt || '';
    const combined = tweakText.trim()
      ? `${originalPrompt}\n\nModifiche richieste: ${tweakText.trim()}`
      : originalPrompt;
    if (!combined.trim()) return;

    regenPromptRef.current = combined;
    setRegenSheet(false);
    setRegenError(null);
    setRegenDone(false);
    setRegenLoading(true);

    try {
      const res = await generateModule(combined, {
        useMock: false,
        language: settings.language || undefined,
        ...(settings.provider === 'ollama'
          ? { ollamaBaseUrl: settings.ollamaUrl || undefined, ollamaModel: settings.ollamaModel || undefined }
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
        setRegenError(t.humanizeError(res.error));
        return;
      }

      const saved = await replaceModule(id, res.data, originalPrompt);
      if (!saved.ok) {
        setRegenError(t.humanizeError(saved.error));
        return;
      }

      setRegenDone(true);
      await new Promise<void>((r) => setTimeout(r, 1200));
      setTweakText('');
      await load();
    } finally {
      setRegenLoading(false);
      setRegenDone(false);
    }
  };

  // ── Style save handler ────────────────────────────────────────────────────
  const onStyleSave = async (
    colorChanges: Map<string, string>,
    textChanges: Map<string, string>
  ) => {
    if (!mod || !id) return;
    setStyleSheet(false);
    let newUi: unknown = mod.ui;
    newUi = applyColorChanges(newUi, colorChanges);
    newUi = applyTextChanges(newUi, textChanges);
    await updateModuleStyle(id, newUi as Parameters<typeof updateModuleStyle>[1]);
    await load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (mod === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: t.tabModules }} />
        <View style={styles.center}>
          <Text style={styles.notFound}>{t.moduleNotFound}</Text>
          <Text style={styles.notFoundSub}>{t.moduleNotFoundSub}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: mod.name,
          headerBackTitle: t.backToModules,
          headerRight: () => (
            <View style={styles.headerBtns}>
              <Pressable onPress={() => setStyleSheet(true)} hitSlop={10}>
                <Ionicons name="color-palette-outline" size={22} color={C.primary} />
              </Pressable>
              <Pressable
                onPress={() => setRegenSheet(true)}
                hitSlop={10}
                style={styles.headerBtn}
              >
                <Ionicons name="refresh" size={20} color={C.primary} />
                <Text style={styles.headerBtnLabel}>{t.regenBtn}</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <StatusBar style="light" />

      {/* Generating modal shown during regen */}
      <GeneratingModal
        visible={regenLoading}
        done={regenDone}
        prompt={regenPromptRef.current}
      />

      {/* Error banner after regen */}
      {regenError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={C.error} />
          <Text style={styles.errorBannerText}>{regenError}</Text>
          <Pressable onPress={() => setRegenError(null)} hitSlop={10}>
            <Ionicons name="close" size={16} color={C.error} />
          </Pressable>
        </View>
      ) : null}

      {needsGate && !answered ? (
        <ModulePermissionGate
          permissions={mod.manifest.permissions}
          onAllow={() => void onAllow()}
          onDeny={onDeny}
          busy={gateBusy}
        />
      ) : motherApi ? (
        <View style={styles.body}>
          <DynamicRenderer ui={mod.ui} code={mod.code} motherApi={motherApi} />
        </View>
      ) : null}

      {/* Style editor sheet */}
      <StyleEditorSheet
        visible={styleSheet}
        ui={mod.ui}
        onClose={() => setStyleSheet(false)}
        onSave={(colorChanges, textChanges) => void onStyleSave(colorChanges, textChanges)}
      />

      {/* Regen bottom sheet */}
      <Modal
        visible={regenSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setRegenSheet(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setRegenSheet(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>{t.regenSheetTitle}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Original prompt */}
              {mod.prompt ? (
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>{t.regenOriginalLabel}</Text>
                  <View style={styles.originalBox}>
                    <Text style={styles.originalText}>{mod.prompt}</Text>
                  </View>
                </View>
              ) : null}

              {/* Tweaks input */}
              <View style={styles.block}>
                <Text style={styles.blockLabel}>{t.regenTweakLabel}</Text>
                <TextInput
                  style={styles.tweakInput}
                  placeholder={t.regenTweakPlaceholder}
                  placeholderTextColor={C.faint}
                  value={tweakText}
                  onChangeText={setTweakText}
                  multiline
                  autoCorrect={false}
                  returnKeyType="default"
                />
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={() => setRegenSheet(false)}>
                  <Text style={styles.cancelBtnText}>{t.cancel}</Text>
                </Pressable>
                <Pressable style={styles.regenBtn} onPress={() => void onRegenConfirm()}>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.regenBtnText}>{t.regenBtn}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: 8 },
  notFound: { color: C.text, fontSize: 18, fontWeight: '700' },
  notFoundSub: { color: C.muted, fontSize: 14 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 4 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerBtnLabel: { color: C.primary, fontSize: 15, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.errorBg,
    borderBottomWidth: 1,
    borderBottomColor: C.errorBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerText: { flex: 1, color: C.error, fontSize: 13, lineHeight: 18 },

  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.faint, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.3,
  },

  block: { gap: 8, marginBottom: 4 },
  blockLabel: {
    fontSize: 11, fontWeight: '700', color: C.faint,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  originalBox: {
    backgroundColor: C.bg, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    padding: 12,
  },
  originalText: { color: C.muted, fontSize: 14, lineHeight: 20 },

  tweakInput: {
    backgroundColor: C.bg, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 14, lineHeight: 20,
    minHeight: 90, textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },

  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  cancelBtnText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  regenBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14, backgroundColor: C.primary,
  },
  regenBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
