import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ApiError } from '../src/api';
import { AppLocaleProvider } from '../src/i18n/app-locale';
import { MapProvider } from '../src/map/map-provider';
import { Mechanic } from '../src/mechanic';
import {
  isMechanicBackgroundLocationRunning,
  publishCurrentMechanicLocation,
  startMechanicBackgroundLocation,
  stopMechanicBackgroundLocation,
} from '../src/mechanic-location';

jest.mock('../src/map/map-provider', () => ({
  MapProvider: jest.fn(() => null),
}));

jest.mock('../src/mechanic-location', () => ({
  isMechanicBackgroundLocationRunning: jest.fn(),
  publishCurrentMechanicLocation: jest.fn(),
  startMechanicBackgroundLocation: jest.fn(),
  stopMechanicBackgroundLocation: jest.fn(),
}));

const profile = {
  userId: 'm1',
  displayName: 'Rahim Auto Care',
  bio: 'Roadside specialist',
  serviceTypes: ['car', 'motorcycle'],
  isOnline: false,
  locationUpdatedAt: null,
};

const availableJob = {
  id: 'req-open-1',
  status: 'open' as const,
  serviceType: 'flat_tire',
  description: 'Front tire is flat near Dhanmondi',
  vehicle: { label: 'Family car', type: 'car' },
  createdAt: '2026-11-25T10:00:00.000Z',
};

const assignedJob = {
  id: 'req-assigned-1',
  status: 'assigned' as const,
  serviceType: 'flat_tire',
  description: 'Front tire is flat near Dhanmondi',
  latitude: 23.7525,
  longitude: 90.3742,
  vehicle: {
    id: 'v1',
    label: 'Family car',
    type: 'car',
    registrationNumber: 'DHAKA METRO GA 12-3456',
  },
  mechanic: { displayName: 'Rahim Auto Care' },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(MapProvider).mockImplementation(({ title }) => <Text>{title}</Text>);
  jest.mocked(isMechanicBackgroundLocationRunning).mockResolvedValue(false);
  jest
    .mocked(publishCurrentMechanicLocation)
    .mockResolvedValue({ locationUpdatedAt: '2026-11-25T10:05:00.000Z' });
  jest.mocked(startMechanicBackgroundLocation).mockResolvedValue({ started: true });
  jest.mocked(stopMechanicBackgroundLocation).mockResolvedValue(undefined);
});

async function renderMechanic(api: jest.Mock, expired = jest.fn()) {
  return render(
    <AppLocaleProvider initialLanguage="en">
      <Mechanic api={api} expired={expired} userId="mechanic-1" />
    </AppLocaleProvider>,
  );
}

it('prompts a new mechanic without a profile (404) to create one and saves it via PUT', async () => {
  let saved = false;
  const api = jest.fn(async (path: string, body?: object, method?: string) => {
    if (path === '/mechanics/me') {
      if (!saved) throw new ApiError(404);
      return profile;
    }
    if (path === '/mechanics/me/profile' && method === 'PUT') {
      saved = true;
      return { ...profile, ...(body as object) };
    }
    if (path === '/service-requests/available') throw new ApiError(400);
    if (path === '/service-requests/assigned/me') return [];
    throw new Error(`Unexpected ${path}`);
  });

  const ui = await renderMechanic(api);
  await waitFor(() =>
    expect(
      ui.getByText('Save your mechanic profile before going online or accepting jobs.'),
    ).toBeOnTheScreen(),
  );

  await fireEvent.changeText(ui.getByLabelText('Display or garage name'), 'Rahim Auto Care');
  await fireEvent.changeText(
    ui.getByLabelText('Supported services (comma-separated, e.g. car, motorcycle)'),
    'car, motorcycle',
  );
  await fireEvent.press(ui.getByRole('button', { name: 'Save profile' }));

  await waitFor(() => expect(ui.getByText('Status: Offline')).toBeOnTheScreen());
  expect(api).toHaveBeenCalledWith(
    '/mechanics/me/profile',
    { displayName: 'Rahim Auto Care', serviceTypes: ['car', 'motorcycle'] },
    'PUT',
  );
});

it('switches online/offline, manages background tracking, and stops tracking before going offline', async () => {
  let isOnline = false;
  const api = jest.fn(async (path: string, body?: { isOnline?: boolean }, method?: string) => {
    if (path === '/mechanics/me') return { ...profile, isOnline };
    if (path === '/mechanics/me/availability' && method === 'PATCH') {
      isOnline = Boolean(body?.isOnline);
      return { ...profile, isOnline };
    }
    if (path === '/service-requests/available') {
      if (!isOnline) throw new ApiError(400);
      return [];
    }
    if (path === '/service-requests/assigned/me') return [];
    throw new Error(`Unexpected ${path}`);
  });

  const ui = await renderMechanic(api);
  await waitFor(() =>
    expect(ui.getByText('Go online to browse available jobs.')).toBeOnTheScreen(),
  );
  expect(api).not.toHaveBeenCalledWith('/service-requests/available');
  await fireEvent.press(ui.getByRole('button', { name: 'Profile & status' }));
  await waitFor(() => expect(ui.getByText('Status: Offline')).toBeOnTheScreen());

  await fireEvent.press(ui.getByRole('button', { name: 'Go online' }));
  await waitFor(() => expect(ui.getByText('Status: Online')).toBeOnTheScreen());
  expect(publishCurrentMechanicLocation).toHaveBeenCalledTimes(1);

  jest
    .mocked(startMechanicBackgroundLocation)
    .mockResolvedValueOnce({ started: false, reason: 'permission_denied' });
  await fireEvent.press(ui.getByRole('button', { name: 'Enable background location' }));
  await waitFor(() =>
    expect(
      ui.getByText(
        'Background location permission was denied. You can still update location manually while online.',
      ),
    ).toBeOnTheScreen(),
  );

  await fireEvent.press(ui.getByRole('button', { name: 'Enable background location' }));
  await waitFor(() =>
    expect(ui.getByText('Background location tracking is active.')).toBeOnTheScreen(),
  );

  await fireEvent.press(ui.getByRole('button', { name: 'Go offline' }));
  await waitFor(() => expect(ui.getByText('Status: Offline')).toBeOnTheScreen());
  expect(stopMechanicBackgroundLocation).toHaveBeenCalled();
});

it('handles HTTP 409 conflict when another mechanic already accepted a job', async () => {
  let available = [availableJob];
  const api = jest.fn(async (path: string) => {
    if (path === '/mechanics/me') return { ...profile, isOnline: true };
    if (path === '/service-requests/available') return available;
    if (path === '/service-requests/assigned/me') return [];
    if (path === '/service-requests/req-open-1/accept') {
      available = [];
      throw new ApiError(409);
    }
    throw new Error(`Unexpected ${path}`);
  });

  const ui = await renderMechanic(api);
  await waitFor(() => expect(ui.getByText('Front tire is flat near Dhanmondi')).toBeOnTheScreen());
  await fireEvent.press(ui.getByRole('button', { name: 'Accept job' }));
  await waitFor(() =>
    expect(
      ui.getByText('This job was already accepted or closed. List refreshed.'),
    ).toBeOnTheScreen(),
  );
  expect(ui.getByText('No open jobs available right now.')).toBeOnTheScreen();
});

it('reveals private pickup details on assigned jobs and confirms lifecycle transition', async () => {
  let currentStatus: 'assigned' | 'en_route' = 'assigned';
  const api = jest.fn(async (path: string, body?: { action?: string }) => {
    if (path === '/mechanics/me') return { ...profile, isOnline: true };
    if (path === '/service-requests/available') return [];
    if (path === '/service-requests/assigned/me')
      return [{ ...assignedJob, status: currentStatus }];
    if (
      path === '/service-requests/req-assigned-1/transitions' &&
      body?.action === 'start_travel'
    ) {
      currentStatus = 'en_route';
      return { ...assignedJob, status: currentStatus };
    }
    throw new Error(`Unexpected ${path}`);
  });

  const ui = await renderMechanic(api);
  await waitFor(() => expect(ui.getByText('No open jobs available right now.')).toBeOnTheScreen());
  await fireEvent.press(ui.getByRole('button', { name: 'Assigned jobs' }));
  await waitFor(() => expect(ui.getByText('assigned')).toBeOnTheScreen());

  expect(ui.queryByText('DHAKA METRO GA 12-3456')).toBeNull();

  await fireEvent.press(ui.getByRole('button', { name: 'View details' }));
  await waitFor(() => expect(ui.getByText('DHAKA METRO GA 12-3456')).toBeOnTheScreen());
  expect(ui.getByText('Customer pickup location')).toBeOnTheScreen();

  await fireEvent.press(ui.getByRole('button', { name: 'Start travel' }));
  await waitFor(() => expect(ui.getByText('Confirm this status update?')).toBeOnTheScreen());
  await fireEvent.press(ui.getByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(ui.getByText('en route')).toBeOnTheScreen());
  expect(api).toHaveBeenCalledWith('/service-requests/req-assigned-1/transitions', {
    action: 'start_travel',
  });
});
