import { Stack } from 'expo-router';

import { AppLocaleProvider } from '../src/i18n/app-locale';

export default function RootLayout() {
  return (
    <AppLocaleProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AppLocaleProvider>
  );
}
