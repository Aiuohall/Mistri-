import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const validUrl = (value: string) => {
  try {
    return (
      ['https:', 'http:'].includes(new URL(value).protocol) &&
      !value.includes('your-project') &&
      !value.includes('192.168.x')
    );
  } catch {
    return false;
  }
};
// Browser sessions remain in memory. Native refresh tokens use OS-protected storage.
const memory = new Map<string, string>();
type StoredChunks = { prefix: string; count: number };
function chunks(value: string | null): StoredChunks | null {
  return value?.startsWith('@chunks:') ? (JSON.parse(value.slice(8)) as StoredChunks) : null;
}
async function deleteChunks(previous: StoredChunks | null) {
  if (previous)
    for (let i = 0; i < previous.count; i++)
      await SecureStore.deleteItemAsync(`${previous.prefix}.${i}`);
}
const storage =
  Platform.OS === 'web'
    ? {
        getItem: async (name: string) => memory.get(name) ?? null,
        setItem: async (name: string, value: string) => {
          memory.set(name, value);
        },
        removeItem: async (name: string) => {
          memory.delete(name);
        },
      }
    : {
        getItem: async (name: string) => {
          const value = await SecureStore.getItemAsync(name);
          const stored = chunks(value);
          if (!stored) return value;
          const parts: string[] = [];
          for (let i = 0; i < stored.count; i++) {
            const part = await SecureStore.getItemAsync(`${stored.prefix}.${i}`);
            if (part === null) return null;
            parts.push(part);
          }
          return parts.join('');
        },
        setItem: async (name: string, value: string) => {
          const previous = chunks(await SecureStore.getItemAsync(name));
          // At most 400 Unicode code points keeps each item under 2 KB without splitting emoji.
          // Write new chunks before replacing the manifest so interrupted writes retain the old session.
          const characters = Array.from(value);
          const stored = {
            prefix: `${name}.${Date.now()}.${Math.random().toString(36).slice(2)}`,
            count: Math.ceil(characters.length / 400),
          };
          for (let i = 0; i < stored.count; i++)
            await SecureStore.setItemAsync(
              `${stored.prefix}.${i}`,
              characters.slice(i * 400, (i + 1) * 400).join(''),
            );
          await SecureStore.setItemAsync(name, '@chunks:' + JSON.stringify(stored));
          await deleteChunks(previous);
        },
        removeItem: async (name: string) => {
          const previous = chunks(await SecureStore.getItemAsync(name));
          await SecureStore.deleteItemAsync(name);
          await deleteChunks(previous);
        },
      };
export const auth =
  validUrl(apiUrl) && validUrl(url) && key && key !== 'your-publishable-key'
    ? createClient(url, key, {
        auth: {
          storage,
          lock: processLock,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
