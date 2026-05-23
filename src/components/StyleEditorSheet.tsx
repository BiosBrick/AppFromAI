import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../i18n/useI18n';
import {
  PALETTE,
  extractColors,
  extractTexts,
  isValidHex,
} from '../modules/styleEditor';
import type { ColorEntry, TextEntry } from '../modules/styleEditor';

const C = {
  bg: '#0b1120',
  surface: '#1a2236',
  surfaceHigh: '#1f2d45',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
  faint: '#3d5070',
  success: '#34d399',
  overlay: 'rgba(0,0,0,0.7)',
};

// ── Color row with inline palette picker ─────────────────────────────────────
function ColorRow({
  entry,
  pendingColor,
  onSelect,
}: {
  entry: ColorEntry;
  pendingColor: string | undefined;
  onSelect: (original: string, newColor: string) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [hexInput, setHexInput] = useState(pendingColor ?? entry.original);
  const displayColor = pendingColor ?? entry.original;
  const changed = !!pendingColor && pendingColor !== entry.original;

  useEffect(() => {
    setHexInput(pendingColor ?? entry.original);
  }, [pendingColor, entry.original]);

  const handlePaletteSelect = (color: string) => {
    onSelect(entry.original, color);
    setExpanded(false);
  };

  const handleHexApply = () => {
    if (isValidHex(hexInput)) {
      onSelect(entry.original, hexInput.toLowerCase());
      setExpanded(false);
    }
  };

  return (
    <View style={rs.colorBlock}>
      <Pressable style={rs.colorRow} onPress={() => setExpanded((v) => !v)}>
        {/* Old color swatch */}
        <View style={[rs.swatch, { backgroundColor: entry.original }]} />

        {changed ? (
          <>
            <Ionicons name="arrow-forward" size={12} color={C.faint} />
            <View style={[rs.swatch, { backgroundColor: displayColor }]} />
          </>
        ) : null}

        <Text style={rs.hexLabel}>{displayColor}</Text>
        <View style={rs.badge}>
          <Text style={rs.badgeText}>{entry.count}×</Text>
        </View>
        {changed ? <View style={rs.changedDot} /> : null}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={C.faint}
        />
      </Pressable>

      {expanded && (
        <View style={rs.picker}>
          {/* Palette grid: 6 swatches per row */}
          <View style={rs.paletteGrid}>
            {PALETTE.map((color) => {
              const isSelected = displayColor.toLowerCase() === color;
              return (
                <Pressable
                  key={color}
                  style={[
                    rs.paletteSwatch,
                    { backgroundColor: color },
                    isSelected && rs.paletteSwatchSelected,
                  ]}
                  onPress={() => handlePaletteSelect(color)}
                >
                  {isSelected ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Hex input row */}
          <View style={rs.hexRow}>
            <View
              style={[
                rs.hexPreview,
                { backgroundColor: isValidHex(hexInput) ? hexInput : C.faint },
              ]}
            />
            <TextInput
              style={rs.hexInput}
              value={hexInput}
              onChangeText={setHexInput}
              placeholder="#000000"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={9}
              onSubmitEditing={handleHexApply}
            />
            <Pressable
              style={[rs.applyBtn, !isValidHex(hexInput) && rs.applyBtnDisabled]}
              disabled={!isValidHex(hexInput)}
              onPress={handleHexApply}
            >
              <Text style={rs.applyBtnText}>{t.styleEditorApply}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────
export function StyleEditorSheet({
  visible,
  ui,
  onClose,
  onSave,
}: {
  visible: boolean;
  ui: unknown;
  onClose: () => void;
  onSave: (colorChanges: Map<string, string>, textChanges: Map<string, string>) => void;
}) {
  const { t } = useI18n();
  const colors = useMemo<ColorEntry[]>(() => extractColors(ui), [ui]);
  const texts = useMemo<TextEntry[]>(() => extractTexts(ui), [ui]);

  const [colorChanges, setColorChanges] = useState<Map<string, string>>(new Map());
  const [textChanges, setTextChanges] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (visible) {
      setColorChanges(new Map());
      setTextChanges(new Map());
    }
  }, [visible]);

  const handleColorSelect = (original: string, newColor: string) => {
    setColorChanges((prev) => new Map(prev).set(original, newColor));
  };

  const handleTextChange = (pathKey: string, newValue: string) => {
    setTextChanges((prev) => new Map(prev).set(pathKey, newValue));
  };

  const hasChanges = colorChanges.size > 0 || textChanges.size > 0;
  const hasContent = colors.length > 0 || texts.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={rs.overlay} onPress={onClose}>
        <Pressable style={rs.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={rs.handle} />
          <Text style={rs.title}>{t.styleEditorTitle}</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={rs.scrollContent}
          >
            {!hasContent ? (
              <Text style={rs.emptyText}>{t.styleEditorNoEditable}</Text>
            ) : (
              <>
                {/* ── Colors ── */}
                {colors.length > 0 && (
                  <View style={rs.section}>
                    <Text style={rs.sectionLabel}>{t.styleEditorColors}</Text>
                    <View style={rs.sectionCard}>
                      {colors.map((entry, i) => (
                        <View
                          key={entry.original}
                          style={i < colors.length - 1 ? rs.itemDivider : undefined}
                        >
                          <ColorRow
                            entry={entry}
                            pendingColor={colorChanges.get(entry.original)}
                            onSelect={handleColorSelect}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── Texts ── */}
                {texts.length > 0 && (
                  <View style={rs.section}>
                    <Text style={rs.sectionLabel}>{t.styleEditorTexts}</Text>
                    <View style={rs.sectionCard}>
                      {texts.map(({ pathKey, value }, i) => (
                        <View
                          key={pathKey}
                          style={[rs.textRow, i < texts.length - 1 && rs.itemDivider]}
                        >
                          <TextInput
                            style={rs.textInput}
                            value={textChanges.get(pathKey) ?? value}
                            onChangeText={(v) => handleTextChange(pathKey, v)}
                            placeholderTextColor={C.faint}
                            returnKeyType="done"
                          />
                          {textChanges.has(pathKey) && (
                            <Pressable
                              hitSlop={8}
                              onPress={() => {
                                setTextChanges((prev) => {
                                  const next = new Map(prev);
                                  next.delete(pathKey);
                                  return next;
                                });
                              }}
                            >
                              <Ionicons name="close-circle" size={16} color={C.faint} />
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── Actions ── */}
            <View style={rs.actions}>
              <Pressable style={rs.cancelBtn} onPress={onClose}>
                <Text style={rs.cancelBtnText}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={[rs.saveBtn, !hasChanges && rs.saveBtnDisabled]}
                disabled={!hasChanges}
                onPress={() => onSave(colorChanges, textChanges)}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={rs.saveBtnText}>{t.styleEditorSave}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const rs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.faint, alignSelf: 'center', marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  scrollContent: { gap: 16, paddingBottom: 8 },

  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.faint,
    letterSpacing: 1.2, paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: C.bg,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  itemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },

  emptyText: { color: C.faint, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 24 },

  /* Color row */
  colorBlock: {},
  colorRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14, gap: 8,
  },
  swatch: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  hexLabel: { flex: 1, color: C.muted, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  badge: {
    backgroundColor: C.surface, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { color: C.faint, fontSize: 11 },
  changedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },

  /* Picker */
  picker: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    padding: 14, gap: 12,
    backgroundColor: C.surfaceHigh,
  },
  paletteGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  paletteSwatch: {
    width: 38, height: 38, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  paletteSwatchSelected: {
    borderWidth: 2, borderColor: '#fff',
  },

  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hexPreview: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  hexInput: {
    flex: 1,
    backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 8,
    color: C.text, fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  applyBtn: {
    backgroundColor: C.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  applyBtnDisabled: { opacity: 0.35 },
  applyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  /* Text rows */
  textRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  textInput: {
    flex: 1, color: C.text, fontSize: 14,
    paddingVertical: 4,
  },

  /* Actions */
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  cancelBtnText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 14, backgroundColor: C.primary,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
