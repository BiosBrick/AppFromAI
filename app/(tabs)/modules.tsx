import { useCallback, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteModule, listModules, renameModule } from '../../src/modules/moduleStore';
import type { StoredModule } from '../../src/types/generatedModule';
import { useI18n } from '../../src/i18n/useI18n';
import { useDeviceLayout } from '../../src/utils/deviceLayout';
import { validateGeneratedModule, toStoredModule } from '../../src/modules/moduleValidator';

const C = {
  bg: '#0b1120',
  surface: '#1a2236',
  surfaceHigh: '#22304a',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
  faint: '#3d5070',
  error: '#f87171',
  errorSurface: '#1a0808',
  errorBorder: '#7f1d1d',
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

export default function ModulesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { isTablet, columns } = useDeviceLayout();
  const [modules, setModules] = useState<StoredModule[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setModules(await listModules());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onDelete = useCallback(
    (item: StoredModule) => {
      Alert.alert(
        t.deleteModuleTitle,
        t.deleteConfirmMsg(item.name),
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.deleteConfirm,
            style: 'destructive',
            onPress: async () => {
              await deleteModule(item.id);
              await load();
            },
          },
        ]
      );
    },
    [load, t]
  );

  const onRename = useCallback(
    async (item: StoredModule, newName: string) => {
      await renameModule(item.id, newName);
      await load();
    },
    [load]
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.h1}>{t.modulesTitle}</Text>
          {modules.length > 0 ? (
            <View style={s.countBadge}>
              <Text style={s.countText}>{modules.length}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={s.importBtn} onPress={onImport}>
          <Ionicons name="download-outline" size={16} color={C.primary} />
          <Text style={s.importBtnText}>Importa</Text>
        </Pressable>
      </View>

      {importMsg ? (
        <View style={[s.importBanner, importMsg.ok ? s.importBannerOk : s.importBannerErr]}>
          <Text style={s.importBannerText}>{importMsg.text}</Text>
        </View>
      ) : null}

      <FlatList
        key={columns}
        data={modules}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
        contentContainerStyle={modules.length === 0 ? s.scrollEmpty : [s.scroll, isTablet && s.scrollTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIconWrapper}>
              <Ionicons name="grid-outline" size={36} color={C.faint} />
            </View>
            <Text style={s.emptyTitle}>{t.emptyTitle}</Text>
            <Text style={s.emptyText}>{t.emptyText(t.tabGenerate)}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={columns > 1 ? { flex: 1 } : undefined}>
            <ModuleCard
              item={item}
              onDelete={onDelete}
              onRename={onRename}
              onOpen={(id) => router.push(`/module/${id}`)}
              onShare={onExport}
              onDownload={onDownload}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function ModuleCard({
  item,
  onDelete,
  onRename,
  onOpen,
  onShare,
  onDownload,
}: {
  item: StoredModule;
  onDelete: (item: StoredModule) => void;
  onRename: (item: StoredModule, newName: string) => void;
  onOpen: (id: string) => void;
  onShare: (item: StoredModule) => void;
  onDownload: (item: StoredModule) => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  const onCopyId = async () => {
    await Clipboard.setStringAsync(item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmRename = () => {
    if (editName.trim() && editName.trim() !== item.name) {
      onRename(item, editName.trim());
    }
    setEditing(false);
  };

  const cancelRename = () => {
    setEditName(item.name);
    setEditing(false);
  };

  const dateStr = new Date(item.createdAt).toLocaleDateString(t.dateLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={() => onOpen(item.id)}
    >
      {/* Top row: title + edit + delete */}
      <View style={s.cardTop}>
        <View style={s.cardTitleRow}>
          {editing ? (
            <>
              <TextInput
                style={s.titleInput}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                onSubmitEditing={confirmRename}
                returnKeyType="done"
                maxLength={60}
              />
              <Pressable style={s.iconBtn} onPress={confirmRename} hitSlop={10}>
                <Ionicons name="checkmark" size={16} color="#34d399" />
              </Pressable>
              <Pressable style={s.iconBtn} onPress={cancelRename} hitSlop={10}>
                <Ionicons name="close" size={16} color={C.muted} />
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.cardTitle} numberOfLines={1}>{item.name}</Text>
              <View style={s.vBadge}>
                <Text style={s.vBadgeText}>v{item.version}</Text>
              </View>
              <Pressable
                style={s.iconBtn}
                onPress={() => { setEditName(item.name); setEditing(true); }}
                hitSlop={10}
              >
                <Ionicons name="pencil-outline" size={15} color={C.muted} />
              </Pressable>
            </>
          )}
        </View>
        {!editing && (
          <Pressable
            style={s.deleteBtn}
            onPress={() => onDelete(item)}
            hitSlop={10}
          >
            <Ionicons name="trash-outline" size={16} color={C.error} />
          </Pressable>
        )}
      </View>

      {/* Date */}
      <Text style={s.cardDate}>{dateStr}</Text>

      {/* ID + copia */}
      <Pressable style={s.idRow} onPress={onCopyId} hitSlop={6}>
        <Text style={s.idText} numberOfLines={1}>{item.id}</Text>
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={13}
          color={copied ? '#34d399' : C.faint}
        />
      </Pressable>

      {/* Permissions */}
      {item.permissions.length > 0 ? (
        <View style={s.permsRow}>
          {item.permissions.map((p) => (
            <View key={p} style={s.permChip}>
              <Text style={s.permChipText}>{PERM_ICON[p] ?? '•'} {p}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Footer */}
      <View style={s.cardFooter}>
        <Text style={s.openText}>{t.openModule}</Text>
        <Ionicons name="arrow-forward" size={14} color={C.primary} />
        <Pressable
          style={s.footerBtn}
          onPress={(e) => { e.stopPropagation?.(); onShare(item); }}
          hitSlop={10}
        >
          <Ionicons name="share-outline" size={15} color={C.muted} />
        </Pressable>
        <Pressable
          style={[s.footerBtn, s.footerBtnDownload]}
          onPress={(e) => { e.stopPropagation?.(); void onDownload(item); }}
          hitSlop={10}
        >
          <Ionicons name="cloud-download-outline" size={15} color={C.primary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  importBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  importBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  importBannerOk: { backgroundColor: '#0a1f0d', borderColor: '#16a34a' },
  importBannerErr: { backgroundColor: C.errorSurface, borderColor: C.errorBorder },
  importBannerText: { color: C.text, fontSize: 13 },
  h1: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  countBadge: {
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  countText: { color: C.muted, fontSize: 13, fontWeight: '700' },

  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  scrollTablet: { paddingHorizontal: 0 },
  scrollEmpty: { flex: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 260 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 9,
  },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { color: C.text, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  titleInput: {
    flex: 1,
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
    borderBottomWidth: 1.5,
    borderBottomColor: C.primary,
    paddingVertical: 2,
    paddingHorizontal: 0,
    minWidth: 80,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  vBadge: {
    backgroundColor: '#1e1b4b',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  vBadgeText: { color: C.primary, fontSize: 11, fontWeight: '700' },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: C.errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.errorBorder,
    flexShrink: 0,
  },

  cardDate: { color: C.muted, fontSize: 12 },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  idText: { color: C.faint, fontSize: 11, fontFamily: 'monospace', flexShrink: 1 },

  permsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  permChip: {
    backgroundColor: C.bg,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  permChipText: { color: C.muted, fontSize: 11 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  openText: { color: C.primary, fontSize: 13, fontWeight: '600', flex: 1 },
  footerBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  footerBtnDownload: {
    backgroundColor: '#1e1b4b',
    borderColor: '#312e81',
  },
});
