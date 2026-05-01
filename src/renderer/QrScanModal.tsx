import { useCallback, useLayoutEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { isQrScanPending, registerQrScanUiOpener, resolveQrScan } from '../capabilities/qrBridge';

export function QrScanModalHost() {
  const [visible, setVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const close = useCallback((result: string | null) => {
    setVisible(false);
    resolveQrScan(result);
  }, []);

  useLayoutEffect(() => {
    registerQrScanUiOpener(() => setVisible(true));
    return () => registerQrScanUiOpener(null);
  }, []);

  const handleBarcode = useCallback(
    (e: BarcodeScanningResult) => {
      if (!isQrScanPending()) return;
      close(e.data);
    },
    [close]
  );

  if (!visible) return null;

  return (
    <Modal animationType="slide" visible transparent={false}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Scansione QR</Text>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Serve l’accesso alla fotocamera.</Text>
            <Pressable style={styles.btn} onPress={() => requestPermission()}>
              <Text style={styles.btnText}>Chiedi permesso</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => close(null)}>
              <Text>Annulla</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode}
            />
            <Pressable style={styles.cancel} onPress={() => close(null)}>
              <Text style={styles.cancelText}>Chiudi</Text>
            </Pressable>
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
  cancel: {
    margin: 24,
    padding: 14,
    backgroundColor: '#374151',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontWeight: '600' },
});
