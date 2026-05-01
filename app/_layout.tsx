import { Stack } from 'expo-router';
import { Fragment } from 'react';
import { CameraCaptureModalHost } from '../src/renderer/CameraCaptureModal';
import { QrScanModalHost } from '../src/renderer/QrScanModal';
import { TorchHost } from '../src/renderer/TorchHost';
import { SettingsProvider } from '../src/settings/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Fragment>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="module/[id]"
            options={{
              headerStyle: { backgroundColor: '#0b1120' },
              headerTintColor: '#e8edf5',
              headerShadowVisible: false,
            }}
          />
        </Stack>
        <CameraCaptureModalHost />
        <QrScanModalHost />
        <TorchHost />
      </Fragment>
    </SettingsProvider>
  );
}
