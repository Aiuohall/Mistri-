import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { NotificationResponse } from 'expo-notifications';
import type { createApi } from './api';

type Api = ReturnType<typeof createApi>;
const storageKey = 'mistri.push-installation';
let registration: Promise<boolean> | undefined;

export const supportsPush =
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

async function storedToken(userId: string): Promise<string | null> {
  if (!supportsPush) return null;
  const stored = await SecureStore.getItemAsync(storageKey);
  const prefix = userId + ':';
  return stored?.startsWith(prefix) ? stored.slice(prefix.length) : null;
}

export function enablePush(api: Api, userId: string) {
  registration ??= (async () => {
    if (!supportsPush) return false;
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string') return false;

    const notifications = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync('job-updates', {
        name: 'Mistri job updates',
        importance: notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await notifications.getPermissionsAsync();
    const permission = existing.granted ? existing : await notifications.requestPermissionsAsync();
    if (!permission.granted) return false;

    const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
    const previous = await storedToken(userId);
    if (previous && previous !== token)
      await api('/push/installations/revoke', { token: previous });
    await SecureStore.setItemAsync(storageKey, userId + ':' + token);
    await api('/push/installations', { token }, 'PUT');
    return true;
  })().finally(() => {
    registration = undefined;
  });
  return registration;
}

export async function refreshPush(api: Api, userId: string) {
  const token = await storedToken(userId);
  if (!token) return false;
  const notifications = await import('expo-notifications');
  if (!(await notifications.getPermissionsAsync()).granted) {
    await disablePush(api, userId);
    return false;
  }
  await api('/push/installations', { token }, 'PUT');
  return true;
}

export function watchPushToken(api: Api, userId: string) {
  let active = true;
  let cleanup: (() => void) | undefined;
  void import('expo-notifications')
    .then((notifications) => {
      if (!active) return;
      const sub = notifications.addPushTokenListener((devicePushToken) => {
        void (async () => {
          const previous = await storedToken(userId);
          const projectId =
            Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
          if (!active || !previous || typeof projectId !== 'string') return;
          const token = (await notifications.getExpoPushTokenAsync({ projectId, devicePushToken }))
            .data;
          if (!active || token === previous || (await storedToken(userId)) !== previous) return;
          await api('/push/installations/revoke', { token: previous });
          await api('/push/installations', { token }, 'PUT');
          await SecureStore.setItemAsync(storageKey, userId + ':' + token);
        })().catch(() => undefined);
      });
      cleanup = () => sub.remove();
    })
    .catch(() => undefined);
  return () => {
    active = false;
    cleanup?.();
  };
}

export async function disablePush(api: Api, userId: string) {
  if (registration) await registration.catch(() => undefined);
  const token = await storedToken(userId);
  if (!token) return;
  await api('/push/installations/revoke', { token });
  await SecureStore.deleteItemAsync(storageKey);
}

export function watchPushResponses(onOpen: (jobId: string) => void) {
  if (!supportsPush) return;
  let active = true;
  let cleanup: (() => void) | undefined;
  void import('expo-notifications')
    .then((notifications) => {
      if (!active) return;
      const open = (response: NotificationResponse) => {
        const id: unknown = response.notification.request.content.data?.jobId;
        if (typeof id === 'string') onOpen(id);
        void notifications.clearLastNotificationResponseAsync();
      };
      const sub = notifications.addNotificationResponseReceivedListener(open);
      cleanup = () => sub.remove();
      const initial = notifications.getLastNotificationResponse();
      if (initial) open(initial);
    })
    .catch(() => undefined);
  return () => {
    active = false;
    cleanup?.();
  };
}
