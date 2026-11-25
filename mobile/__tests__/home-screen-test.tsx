import { fireEvent, render } from '@testing-library/react-native';

import HomeScreen from '../app/index';
import { AppLocaleProvider } from '../src/i18n/app-locale';
import {
  bangla,
  english,
  getLanguageFromCode,
  translate,
  type TranslationKey,
} from '../src/i18n/translations';

jest.mock('../src/auth', () => ({ auth: null, apiUrl: '' }));

describe('<HomeScreen />', () => {
  it('switches the introduction between English and Bangla', async () => {
    const screen = await render(
      <AppLocaleProvider initialLanguage="en">
        <HomeScreen />
      </AppLocaleProvider>,
    );

    expect(screen.getByText('Mistri')).toBeOnTheScreen();
    expect(screen.getByText('Roadside assistance, when you need it.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'বাংলায় দেখুন' }));

    expect(screen.getByText('মিস্ত্রি')).toBeOnTheScreen();
    expect(screen.getByText('প্রয়োজনে সড়ক সহায়তা, আপনার পাশে।')).toBeOnTheScreen();
  });
});

describe('translations', () => {
  it('translates every customer and account key into Bangla', () => {
    for (const key of Object.keys(english) as TranslationKey[]) {
      if (key === 'common.retry') continue;
      expect(bangla[key]).toBeTruthy();
      expect(translate('bn', key)).toBe(bangla[key]);
    }
  });
  it('uses Bangla strings when they are available', () => {
    expect(translate('bn', 'home.tagline')).toBe('প্রয়োজনে সড়ক সহায়তা, আপনার পাশে।');
  });

  it('falls back to English when a Bangla string is unavailable', () => {
    expect(translate('bn', 'common.retry')).toBe('Try again');
  });

  it('selects Bangla only for a Bangla device language', () => {
    expect(getLanguageFromCode('bn')).toBe('bn');
    expect(getLanguageFromCode('en')).toBe('en');
    expect(getLanguageFromCode('fr')).toBe('en');
  });
});
