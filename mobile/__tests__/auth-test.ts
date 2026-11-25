import { createClient } from '@supabase/supabase-js';
import '../src/auth';

jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (name: string) => values.get(name) ?? null),
    setItemAsync: jest.fn(async (name: string, value: string) => {
      // Native UTF-8 conversion cannot safely persist unpaired UTF-16 surrogates.
      const bytes = encodeURIComponent(value).replace(/%[A-F\d]{2}/g, 'x').length;
      if (bytes > 2048) throw new Error('Value too large');
      values.set(name, value);
    }),
    deleteItemAsync: jest.fn(async (name: string) => {
      values.delete(name);
    }),
  };
});
jest.mock('@supabase/supabase-js', () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  return { createClient: jest.fn(() => ({})), processLock: jest.fn() };
});

describe('native session storage', () => {
  it('stores, replaces and removes sessions larger than a SecureStore item', async () => {
    const storage = jest.mocked(createClient).mock.calls[0][2]!.auth!.storage!;
    const largeSession = JSON.stringify({
      access_token: 'a'.repeat(5000),
      name: 'বাংলা🚗'.repeat(200),
    });
    await storage.setItem('session', largeSession);
    expect(await storage.getItem('session')).toBe(largeSession);
    await storage.setItem('session', 'replacement');
    expect(await storage.getItem('session')).toBe('replacement');
    await storage.removeItem('session');
    expect(await storage.getItem('session')).toBeNull();
  });
});
