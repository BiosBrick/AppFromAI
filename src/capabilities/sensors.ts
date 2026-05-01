import {
  Accelerometer,
  Barometer,
  Gyroscope,
  LightSensor,
  Magnetometer,
} from 'expo-sensors';

type Subscription = { remove: () => void };
type SensorModule<T extends Record<string, number>> = {
  isAvailableAsync: () => Promise<boolean>;
  setUpdateInterval: (intervalMs: number) => void;
  addListener: (listener: (event: T) => void) => Subscription;
};

async function readSensorOnce<T extends Record<string, number>>(
  sensor: SensorModule<T>,
  label: string
): Promise<T> {
  const available = await sensor.isAvailableAsync();
  if (!available) {
    throw new Error(`${label} non disponibile su questo dispositivo`);
  }
  sensor.setUpdateInterval(250);
  return new Promise((resolve, reject) => {
    let done = false;
    let sub: Subscription | null = null;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      sub?.remove();
      reject(new Error(`${label}: nessun dato ricevuto`));
    }, 1500);

    sub = sensor.addListener((event) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub?.remove();
      resolve(event);
    });
  });
}

export function createSensorsCapability() {
  return {
    getAccelerometer: () => readSensorOnce(Accelerometer, 'Accelerometro'),
    getGyroscope: () => readSensorOnce(Gyroscope, 'Giroscopio'),
    getMagnetometer: () => readSensorOnce(Magnetometer, 'Magnetometro'),
    getBarometer: () => readSensorOnce(Barometer, 'Barometro'),
    getLight: () => readSensorOnce(LightSensor, 'Sensore luce'),
  };
}
