import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getModule } from '../../src/modules/moduleStore';
import type { MotherPermission } from '../../src/types/generatedModule';
import { CapabilityRegistry } from '../../src/capabilities/capabilityRegistry';
import { createMotherApi } from '../../src/capabilities/motherApi';
import { isModuleNetworkFetchEnabled } from '../../src/config';
import { DynamicRenderer } from '../../src/renderer/DynamicRenderer';
import { ModulePermissionGate } from '../../src/renderer/ModulePermissionGate';
import { prefetchNativePermissions } from '../../src/security/runtimePermissions';
import { useI18n } from '../../src/i18n/useI18n';

const C = {
  bg: '#0b1120',
  text: '#e8edf5',
  muted: '#7a92b3',
};

export default function ModuleScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [mod, setMod] = useState<Awaited<ReturnType<typeof getModule>>>(null);
  const [loading, setLoading] = useState(true);
  const [needsGate, setNeedsGate] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [grantedIds, setGrantedIds] = useState<MotherPermission[]>([]);
  const [gateBusy, setGateBusy] = useState(false);

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

  useEffect(() => {
    void load();
  }, [load]);

  // Registry fresh per ogni modulo: pulisce tutti i sensori attivi all'unmount.
  const registry = useMemo(() => new CapabilityRegistry(), [mod?.id]);
  useEffect(() => {
    return () => {
      void registry.cleanupAll();
    };
  }, [registry]);

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
      <Stack.Screen options={{ title: mod.name, headerBackTitle: t.backToModules }} />
      <StatusBar style="light" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: 8 },
  notFound: { color: C.text, fontSize: 18, fontWeight: '700' },
  notFoundSub: { color: C.muted, fontSize: 14 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
});
