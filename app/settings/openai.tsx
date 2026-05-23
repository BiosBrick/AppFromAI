import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../../src/settings/SettingsContext';

const C = {
  bg: '#0b1120',
  surface: '#1a2236',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
  faint: '#3d5070',
  success: '#34d399',
};

export default function OpenAISettings() {
  const { settings, updateSettings } = useSettings();
  const router = useRouter();
  const isActive = settings.provider === 'openai';

  const activate = () => {
    updateSettings({ provider: 'openai' });
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={[s.banner, isActive && s.bannerActive]}>
          <Ionicons
            name={isActive ? 'checkmark-circle' : 'radio-button-off'}
            size={20}
            color={isActive ? C.success : C.muted}
          />
          <Text style={[s.bannerText, isActive && s.bannerTextActive]}>
            {isActive ? 'Provider attivo' : 'Non selezionato come provider'}
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>API URL</Text>
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
          <Text style={s.hint}>
            Compatibile con qualsiasi endpoint OpenAI-compatible (LM Studio, Together AI, Groq…)
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>API KEY</Text>
          <TextInput
            style={s.input}
            placeholder="sk-..."
            placeholderTextColor={C.faint}
            value={settings.openaiKey}
            onChangeText={(v) => updateSettings({ openaiKey: v })}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            returnKeyType="done"
          />
        </View>

        <View style={s.card}>
          <Text style={s.label}>MODELLO</Text>
          <TextInput
            style={s.input}
            placeholder="gpt-4o-mini"
            placeholderTextColor={C.faint}
            value={settings.openaiModel}
            onChangeText={(v) => updateSettings({ openaiModel: v })}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          <Text style={s.hint}>Esempi: gpt-4o-mini, gpt-4o, gpt-4.1-mini</Text>
        </View>

        {!isActive && (
          <Pressable style={s.activateBtn} onPress={activate}>
            <Ionicons name="radio-button-on" size={18} color="#fff" />
            <Text style={s.activateBtnText}>Usa OpenAI</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1120' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  bannerActive: { borderColor: C.success + '60', backgroundColor: '#03180f' },
  bannerText: { color: C.muted, fontSize: 14 },
  bannerTextActive: { color: C.success },

  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.faint,
    letterSpacing: 1.1,
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
  hint: { color: C.faint, fontSize: 12, lineHeight: 18 },

  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  activateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
