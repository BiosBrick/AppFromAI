import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { registerCameraCaptureUiOpener, resolveCameraPhoto } from '../capabilities/cameraBridge';

export function CameraCaptureModalHost() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = useCallback((result: { uri: string; fileUri?: string; width?: number; height?: number } | null) => {
    setBusy(false);
    setVisible(false);
    resolveCameraPhoto(result);
  }, []);

  useLayoutEffect(() => {
    registerCameraCaptureUiOpener(() => {
      setVisible(true);
    });
    return () => registerCameraCaptureUiOpener(null);
  }, []);

  const takePhoto = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        close(null);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.55,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        close(null);
        return;
      }

      const photo = result.assets[0];
      let finalUri = photo.uri;
      try {
        const src = new File(photo.uri);
        const dest = new File(Paths.document, `cam_${Date.now()}.jpg`);
        src.copy(dest);
        finalUri = dest.uri;
      } catch {
        // fallback: use original URI
      }
      const previewUri = photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : finalUri;
      close({ uri: previewUri, fileUri: finalUri, width: photo.width, height: photo.height });
    } catch {
      close(null);
    }
  }, [busy, close]);

  if (!visible) return null;

  return (
    <Modal animationType="slide" visible transparent={false}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Fotocamera</Text>
        <View style={styles.center}>
          <Text style={styles.msg}>Apri la fotocamera di sistema per scattare una foto.</Text>
          <Pressable style={[styles.shutter, busy && styles.shutterDisabled]} onPress={takePhoto} disabled={busy}>
            {busy ? <ActivityIndicator color="#111827" /> : <Text style={styles.shutterText}>Scatta foto</Text>}
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => close(null)} disabled={busy}>
            <Text style={styles.secondaryText}>Annulla</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', paddingTop: 48 },
  title: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { color: '#fff', textAlign: 'center', marginBottom: 16 },
  secondary: { marginTop: 16 },
  secondaryText: { color: '#fff' },
  shutter: {
    minWidth: 180,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterText: { color: '#111827', fontWeight: '700' },
});
