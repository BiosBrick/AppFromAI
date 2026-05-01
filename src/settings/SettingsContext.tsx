import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppSettings, defaultSettings, loadSettings, persistSettings } from './settingsStore';

type SettingsCtx = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
};

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void persistSettings(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ settings, updateSettings }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
