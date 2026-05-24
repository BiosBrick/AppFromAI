import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from 'expo-router';
import { LocalLlmModule, MODEL_CATALOG, type ModelEntry, type DownloadedModel } from '../src/native/LocalLlmModule';
import { useSettings } from '../src/settings/SettingsContext';

const C = {
  bg:          '#0b1120',
  surface:     '#1a2236',
  surfaceHigh: '#22304a',
  border:      '#2d3f5c',
  primary:     '#6366f1',
  success:     '#22c55e',
  danger:      '#ef4444',
  warning:     '#f59e0b',
  text:        '#e8edf5',
  muted:       '#7a92b3',
  faint:       '#3d5070',
};

type DownloadState = {
  percent: number;
  downloaded: number;
  total: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function LocalModelsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();

  // Catalog is always available from the static JS definition — no native call needed.
  const catalog = MODEL_CATALOG;

  const [downloaded, setDownloaded]   = useState<Set<string>>(new Set());
  const [loadedId, setLoadedId]       = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, DownloadState>>({});
  const [loading, setLoading]         = useState<Record<string, boolean>>({});
  const [hfToken, setHfToken]         = useState('');
  const [busy, setBusy]               = useState(LocalLlmModule.isSupported);

  const unsubRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    if (!LocalLlmModule.isSupported) return;
    try {
      const [dls, lid] = await Promise.all([
        LocalLlmModule.getDownloadedModels(),
        LocalLlmModule.getLoadedModelId(),
      ]);
      setDownloaded(new Set(dls.map((d: DownloadedModel) => d.id)));
      setLoadedId(lid);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    if (LocalLlmModule.isSupported) {
      unsubRef.current = LocalLlmModule.addDownloadProgressListener((evt) => {
        setDownloading((prev) => ({
          ...prev,
          [evt.modelId]: { percent: evt.percent, downloaded: evt.downloaded, total: evt.total },
        }));
      });
    }

    return () => { unsubRef.current?.(); };
  }, [refresh]);

  const handleDownload = useCallback(async (model: ModelEntry) => {
    const token = hfToken.trim();
    if (model.gated && !token) {
      Alert.alert(
        'HuggingFace Token Required',
        `"${model.name}" is a gated model (Google license).\n\n1. Go to huggingface.co and accept the model license\n2. Create an HF access token (hf_…) in your profile settings\n3. Paste the token in the field above and retry.`,
        [{ text: 'OK' }]
      );
      return;
    }
    setDownloading((prev) => ({ ...prev, [model.id]: { percent: 0, downloaded: 0, total: model.sizeBytes } }));
    try {
      await LocalLlmModule.downloadModel(model.id, token || undefined);
      setDownloaded((prev) => new Set([...prev, model.id]));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Download failed', msg);
    } finally {
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
    }
  }, [hfToken]);

  const handleCancelDownload = useCallback((modelId: string) => {
    LocalLlmModule.cancelDownload(modelId);
    setDownloading((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  }, []);

  const handleLoad = useCallback(async (model: ModelEntry) => {
    setLoading((prev) => ({ ...prev, [model.id]: true }));
    try {
      await LocalLlmModule.loadModel(model.id);
      setLoadedId(model.id);
      updateSettings({ provider: 'local', localModelId: model.id });
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Load failed', msg);
      setLoading((prev) => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
    }
  }, [updateSettings, router]);

  const handleDelete = useCallback((model: ModelEntry) => {
    Alert.alert(
      'Delete model',
      `Delete "${model.name}"? You will need to download it again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await LocalLlmModule.deleteModel(model.id);
            setDownloaded((prev) => {
              const next = new Set(prev);
              next.delete(model.id);
              return next;
            });
            if (loadedId === model.id) {
              setLoadedId(null);
              updateSettings({ localModelId: '' });
            }
          },
        },
      ]
    );
  }, [loadedId, updateSettings]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.h1}>Local Models</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Android-only warning banner */}
        {!LocalLlmModule.isSupported ? (
          <View style={s.warningBanner}>
            <Ionicons name="phone-portrait-outline" size={16} color={C.warning} />
            <Text style={s.warningBannerText}>
              Download and inference require a native Android build (<Text style={s.mono}>expo run:android</Text>). You can browse the catalog below.
            </Text>
          </View>
        ) : (
          <View style={s.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={C.primary} />
            <Text style={s.infoBannerText}>
              Models run entirely on your device via LiteRT-LM. No internet needed for inference.
              Minimum ~600 MB free storage. Models from{' '}
              <Text style={s.link}>huggingface.co/litert-community</Text>.
            </Text>
          </View>
        )}

        {/* HuggingFace token (optional) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>HUGGING FACE TOKEN (OPTIONAL)</Text>
          <View style={s.sectionBox}>
            <View style={s.inputGroup}>
              <TextInput
                style={s.input}
                placeholder="hf_…"
                placeholderTextColor={C.faint}
                value={hfToken}
                onChangeText={setHfToken}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                returnKeyType="done"
              />
              <Text style={s.inputHint}>
                Required only for gated models. All litert-community models are public.
              </Text>
            </View>
          </View>
        </View>

        {/* Model catalog */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>AVAILABLE MODELS</Text>
          <View style={s.sectionBox}>
            {busy ? (
              <View style={s.centerRow}>
                <ActivityIndicator color={C.primary} />
              </View>
            ) : (
              catalog.map((model, idx) => {
                const isDownloaded    = downloaded.has(model.id);
                const isLoaded        = loadedId === model.id; // in native memory
                const isActiveProvider = settings.provider === 'local' && settings.localModelId === model.id;
                const dlState         = downloading[model.id];
                const isLoading       = loading[model.id];
                const isLast          = idx === catalog.length - 1;

                return (
                  <View key={model.id} style={[s.modelRow, !isLast && s.rowDivider]}>
                    {/* Left: info */}
                    <View style={s.modelInfo}>
                      <View style={s.modelNameRow}>
                        <Text style={s.modelName}>{model.name}</Text>
                        {isActiveProvider && (
                          <View style={s.activeBadge}>
                            <Text style={s.activeBadgeText}>ACTIVE</Text>
                          </View>
                        )}
                        {model.gated && (
                          <View style={s.gatedBadge}>
                            <Ionicons name="key-outline" size={9} color={C.warning} />
                            <Text style={s.gatedBadgeText}>TOKEN</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.modelDesc}>{model.description}</Text>
                      <Text style={s.modelSize}>{formatBytes(model.sizeBytes)}</Text>

                      {/* Download progress */}
                      {dlState && (
                        <View style={s.progressContainer}>
                          <View style={s.progressBar}>
                            <View style={[s.progressFill, { width: `${dlState.percent}%` }]} />
                          </View>
                          <Text style={s.progressText}>
                            {dlState.percent}% — {formatBytes(dlState.downloaded)} / {formatBytes(dlState.total)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Right: actions */}
                    <View style={s.modelActions}>
                      {!LocalLlmModule.isSupported ? (
                        <View style={s.btnDisabledBox}>
                          <Ionicons name="phone-portrait-outline" size={13} color={C.faint} />
                          <Text style={s.btnDisabledText}>Android</Text>
                        </View>
                      ) : dlState ? (
                        <Pressable style={s.btnDanger} onPress={() => handleCancelDownload(model.id)}>
                          <Ionicons name="close" size={14} color="#fff" />
                          <Text style={s.btnText}>Cancel</Text>
                        </Pressable>
                      ) : isDownloaded ? (
                        <>
                          {!isActiveProvider && (
                            <Pressable
                              style={[s.btnPrimary, isLoading && s.btnDisabled]}
                              onPress={() => handleLoad(model)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Ionicons name="play" size={14} color="#fff" />
                              )}
                              <Text style={s.btnText}>{isLoading ? 'Loading…' : 'Select'}</Text>
                            </Pressable>
                          )}
                          <Pressable
                            style={[s.btnOutline, isLoaded && s.btnDisabledOutline]}
                            onPress={() => handleDelete(model)}
                            disabled={isLoaded}
                          >
                            <Ionicons name="trash-outline" size={14} color={isLoaded ? C.faint : C.danger} />
                          </Pressable>
                        </>
                      ) : (
                        <Pressable style={s.btnSecondary} onPress={() => handleDownload(model)}>
                          <Ionicons name="download-outline" size={14} color={C.text} />
                          <Text style={s.btnTextSecondary}>Download</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Currently loaded */}
        {settings.provider === 'local' && settings.localModelId ? (
          <View style={s.loadedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
            <Text style={s.loadedBannerText}>
              Active: <Text style={{ color: C.success }}>{catalog.find((m) => m.id === settings.localModelId)?.name ?? settings.localModelId}</Text>
              {'\n'}This model is selected as your AI provider.
            </Text>
          </View>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 20, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  h1: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4 },

  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.surfaceHigh,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.primary,
    alignItems: 'flex-start',
  },
  infoBannerText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  link: { color: C.primary },

  warningBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.surfaceHigh,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.warning,
    alignItems: 'flex-start',
  },
  warningBannerText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: C.warning },

  btnDisabledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.faint,
  },
  btnDisabledText: { color: C.faint, fontSize: 11 },

  section:      { gap: 7 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: C.faint,
    letterSpacing: 1.2, paddingHorizontal: 4,
  },
  sectionBox: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },

  inputGroup:  { padding: 16, gap: 8 },
  input: {
    backgroundColor: C.bg, borderRadius: 10, borderWidth: 1,
    borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputHint: { color: C.faint, fontSize: 11, lineHeight: 16 },

  centerRow: { alignItems: 'center', padding: 24 },

  modelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  modelInfo:    { flex: 1, gap: 4 },
  modelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modelName:    { color: C.text, fontSize: 14, fontWeight: '700' },
  modelDesc:    { color: C.muted, fontSize: 12, lineHeight: 17 },
  modelSize:    { color: C.faint, fontSize: 11 },

  activeBadge: {
    backgroundColor: C.success + '22',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.success,
  },
  activeBadgeText: { color: C.success, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  gatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: C.warning + '22',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.warning,
  },
  gatedBadgeText: { color: C.warning, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  progressContainer: { gap: 4, marginTop: 4 },
  progressBar: {
    height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progressText: { color: C.muted, fontSize: 11 },

  modelActions: { flexDirection: 'column', gap: 8, alignItems: 'flex-end', paddingTop: 2 },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.surfaceHigh, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: C.border,
  },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.danger, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  btnOutline: {
    padding: 7, borderRadius: 8,
    borderWidth: 1, borderColor: C.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled:        { opacity: 0.5 },
  btnDisabledOutline: { borderColor: C.faint, opacity: 0.4 },
  btnText:       { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnTextSecondary: { color: C.text, fontSize: 12, fontWeight: '600' },

  loadedBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.success + '15',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.success,
    alignItems: 'flex-start',
  },
  loadedBannerText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },

});
