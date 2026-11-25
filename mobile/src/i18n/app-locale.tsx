import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import {
  getDeviceLanguage,
  translate,
  type AppLanguage,
  type TranslationKey,
} from './translations';

type AppLocaleContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
};

const AppLocaleContext = createContext<AppLocaleContextValue | undefined>(undefined);

type AppLocaleProviderProps = PropsWithChildren<{
  initialLanguage?: AppLanguage;
}>;

export function AppLocaleProvider({ children, initialLanguage }: AppLocaleProviderProps) {
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage ?? getDeviceLanguage);
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey) => translate(language, key),
    }),
    [language],
  );

  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale(): AppLocaleContextValue {
  const context = useContext(AppLocaleContext);

  if (!context) {
    throw new Error('useAppLocale must be used within an AppLocaleProvider.');
  }

  return context;
}
