import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { registerTorchHost } from '../capabilities/torchBridge';

/**
 * TorchHost — gestisce la sessione camera minima per la torcia LED.
 *
 * Problema risolto:
 *   expo-camera onCameraReady NON si scatena in modo affidabile quando active
 *   passa da false → true dopo il primo ciclo (camera riavviata). Se usassimo
 *   solo onCameraReady per abilitare enableTorch, la torcia funzionerebbe solo
 *   alla prima accensione.
 *
 * Soluzione — doppia via:
 *   1. onCameraReady: via veloce, arma la torcia non appena la camera è pronta.
 *   2. Timer di fallback (WARMUP_MS): se onCameraReady non arriva entro il timeout,
 *      la torcia viene armata comunque. Copre i riavvii successivi al primo.
 *
 * Ciclo per ogni accensione:
 *   api.torch.setEnabled(true)
 *     → torchHandler(true)
 *     → cameraActive = true   (avvia la sessione camera)
 *     → parte il timer fallback
 *     → onCameraReady (se arriva prima del timer) → annulla timer, enableTorch = true
 *     → oppure: timer scade → enableTorch = true
 *
 * Ciclo per ogni spegnimento:
 *   api.torch.setEnabled(false)
 *     → torchHandler(false)
 *     → annulla timer, enableTorch = false, cameraActive = false
 */

/** Millisecondi massimi di attesa prima di forzare enableTorch anche senza onCameraReady. */
const WARMUP_MS = 600;

export function TorchHost() {
  const [cameraActive, setCameraActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Tiene traccia di quante richieste di accensione sono state fatte:
  // serve per evitare che un timer scaduto "in ritardo" accenda la torcia
  // dopo che l'utente l'ha già spenta.
  const requestIdRef = useRef(0);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armTorch = useCallback((reqId: number) => {
    // Ignora l'armamento se nel frattempo la richiesta è cambiata (es. utente ha spento).
    if (reqId !== requestIdRef.current) return;
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
    setTorchEnabled(true);
  }, []);

  const handleCameraReady = useCallback(() => {
    armTorch(requestIdRef.current);
  }, [armTorch]);

  useLayoutEffect(() => {
    const handler = (on: boolean) => {
      if (on) {
        // Nuova richiesta di accensione: incrementa l'id per invalidare eventuali
        // timer precedenti ancora in volo.
        const reqId = ++requestIdRef.current;
        setCameraActive(true);
        // Fallback: se onCameraReady non arriva, accendi dopo WARMUP_MS.
        if (fallbackRef.current) clearTimeout(fallbackRef.current);
        fallbackRef.current = setTimeout(() => armTorch(reqId), WARMUP_MS);
      } else {
        // Spegnimento: cancella tutto e resetta.
        requestIdRef.current++;          // invalida qualsiasi timer/onCameraReady pendente
        if (fallbackRef.current) {
          clearTimeout(fallbackRef.current);
          fallbackRef.current = null;
        }
        setTorchEnabled(false);
        setCameraActive(false);
      }
    };

    registerTorchHost(handler);
    return () => {
      registerTorchHost(null);
      requestIdRef.current++;
      if (fallbackRef.current) {
        clearTimeout(fallbackRef.current);
        fallbackRef.current = null;
      }
      setTorchEnabled(false);
      setCameraActive(false);
    };
  }, [armTorch]);

  // Non montare CameraView finché non serve: su Android il semplice mount
  // inizializza l'hardware e accende il LED di privacy anche con active={false}.
  if (!cameraActive) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <CameraView
        style={styles.cam}
        facing="back"
        enableTorch={torchEnabled}
        active={cameraActive}
        onCameraReady={handleCameraReady}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 2,
    height: 2,
    opacity: 0.02,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  cam: { flex: 1 },
});
