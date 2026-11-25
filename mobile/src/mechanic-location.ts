import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { createApi, isLocationUpdateResult, isValidCoordinate } from './api';
import type { LocationUpdateResult } from './api';
import { apiUrl, auth } from './auth';

export const MECHANIC_LOCATION_TASK = 'MISTRI_MECHANIC_BACKGROUND_LOCATION';
const TRACKING_OWNER_KEY = 'mistri.mechanicLocationOwner';

export type BackgroundLocationStartResult =
  { started: true } | { started: false; reason: 'unsupported' | 'permission_denied' | 'failed' };

type LocationTaskPayload = {
  locations?: Location.LocationObject[];
};

if (Platform.OS !== 'web' && typeof TaskManager.defineTask === 'function') {
  TaskManager.defineTask<LocationTaskPayload>(MECHANIC_LOCATION_TASK, async ({ data, error }) => {
    if (error || !auth || !data?.locations?.length) return;
    const latest = data.locations[data.locations.length - 1];
    const { latitude, longitude } = latest.coords;
    if (!isValidCoordinate(latitude, longitude)) return;
    const api = createApi(apiUrl, async () => {
      const session = (await auth?.auth.getSession())?.data.session;
      const owner = await SecureStore.getItemAsync(TRACKING_OWNER_KEY);
      return session && owner === session.user.id ? session.access_token : undefined;
    });
    try {
      await api('/mechanics/me/location', { latitude, longitude }, 'PUT');
    } catch {
      // Expected 400 throttle/distance rejections or offline errors are ignored in background tasks.
    }
  });
}

export function isBackgroundLocationSupported(): boolean {
  return Platform.OS !== 'web';
}

export async function isMechanicBackgroundLocationRunning(): Promise<boolean> {
  if (!isBackgroundLocationSupported()) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(MECHANIC_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function startMechanicBackgroundLocation(notification: {
  userId: string;
  title: string;
  body: string;
}): Promise<BackgroundLocationStartResult> {
  if (!isBackgroundLocationSupported()) {
    return { started: false, reason: 'unsupported' };
  }
  try {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) {
      return { started: false, reason: 'permission_denied' };
    }
    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) {
      return { started: false, reason: 'permission_denied' };
    }
    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(MECHANIC_LOCATION_TASK);
    await SecureStore.setItemAsync(TRACKING_OWNER_KEY, notification.userId);
    if (!alreadyRunning) {
      await Location.startLocationUpdatesAsync(MECHANIC_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15_000,
        distanceInterval: 50,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: notification.title,
          notificationBody: notification.body,
        },
      });
    }
    return { started: true };
  } catch {
    await stopMechanicBackgroundLocation();
    return { started: false, reason: 'failed' };
  }
}

export async function stopMechanicBackgroundLocation(): Promise<void> {
  if (!isBackgroundLocationSupported()) return;
  try {
    await SecureStore.deleteItemAsync(TRACKING_OWNER_KEY);
  } catch {
    // Attempt to stop the native task even when secure storage is unavailable.
  }
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(MECHANIC_LOCATION_TASK);
    if (running) {
      await Location.stopLocationUpdatesAsync(MECHANIC_LOCATION_TASK);
    }
  } catch {
    // Ignore cleanup errors when stopping background tracking.
  }
}

export async function publishCurrentMechanicLocation(
  api: ReturnType<typeof createApi>,
): Promise<LocationUpdateResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission denied');
  }
  const reading = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = reading.coords;
  if (!isValidCoordinate(latitude, longitude)) {
    throw new Error('Invalid location');
  }
  const result = await api('/mechanics/me/location', { latitude, longitude }, 'PUT');
  if (!isLocationUpdateResult(result)) {
    throw new Error('Invalid server response');
  }
  return result;
}
