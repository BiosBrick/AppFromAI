import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { registerCameraCaptureUiOpener, resolveCameraPhoto } from '../capabilities/cameraBridge';

type CameraRef = {
  takePictureAsync: (options?: {
    quality?: number;
    base64?: boolean;
    skipProcessing?: boolean;
  }) => Promise<{ uri: string; width?: number; height?: number }>;
};

export function CameraCaptureModalHost() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);

  const close = useCallback((result: { uri: string; width?: number; height?: number } | null) => {
    setBusy(false);
    setVisible(false);
    resolveCameraPhoto(result);
  }, []);

  useLayoutEffect(() => {
    registerCameraCaptureUiOpener(() => setVisible(true));
    return () => registerCameraCaptureUiOpener(null);
  }, []);

  const takePhoto = useCallback(async () => {
    if (busy) return;
    // Se la camera non è ancora inizializzata, risolvi con null invece di
    // restare appesi: l'action riceve null e può gestirlo (es. "Foto annullata").
    if (!cameraRef.current) {
      close(null);
      return;
    }
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
      });
      close({ uri: photo.uri, width: photo.width, height: photo.height });
    } catch {
      close(null);
    }
  }, [busy, close]);

  if (!visible) return null;

  return (
    <Modal animationType="slide" visible transparent={false}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Fotocamera</Text>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Serve l'accesso alla fotocamera.</Text>
            <Pressable style={styles.btn} onPress={() => requestPermission()}>
              <Text style={styles.btnText}>Chiedi permesso</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => close(null)}>
              <Text style={styles.secondaryText}>Annulla</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              ref={(ref) => {
                cameraRef.current = ref as unknown as CameraRef | null;
              }}
              style={styles.camera}
              facing="back"
            />
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={() => close(null)} disabled={busy}>
                <Text style={styles.cancelText}>Chiudi</Text>
              </Pressable>
              <Pressable style={styles.shutter} onPress={takePhoto} disabled={busy}>
                {busy ? <ActivityIndicator color="#111827" /> : <Text style={styles.shutterText}>Scatta</Text>}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', paddingTop: 48 },
  title: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 12 },
  camera: { flex: 1, borderRadius: 12, overflow: 'hidden', marginHorizontal: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { color: '#fff', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  secondary: { marginTop: 16 },
  secondaryText: { color: '#fff' },
  actions: { flexDirection: 'row', gap: 12, padding: 24 },
  cancel: {
    flex: 1,
    padding: 14,
    backgroundColor: '#374151',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontWeight: '600' },
  shutter: {
    flex: 1,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
  },
  shutterText: { color: '#111827', fontWeight: '700' },
});
