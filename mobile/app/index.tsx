import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppLocale } from '../src/i18n/app-locale';
import { Account } from '../src/account';
import { Screen } from '../src/ui';

export default function HomeScreen() {
  const { language, setLanguage, t } = useAppLocale();
  const switchLanguage = language === 'en' ? 'bn' : 'en';

  return (
    <Screen>
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('app.name')}
        </Text>
        <Text style={styles.description}>{t('home.tagline')}</Text>
        <Pressable
          accessibilityLabel={t(
            language === 'en' ? 'language.switchToBangla' : 'language.switchToEnglish',
          )}
          accessibilityRole="button"
          onPress={() => setLanguage(switchLanguage)}
          style={styles.languageButton}
        >
          <Text style={styles.languageButtonText}>
            {t(language === 'en' ? 'language.switchToBangla' : 'language.switchToEnglish')}
          </Text>
        </Pressable>
      </View>
      <Account />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
  },
  languageButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  languageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
