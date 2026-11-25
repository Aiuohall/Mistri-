import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Customer } from '../src/customer';
import { AppLocaleProvider } from '../src/i18n/app-locale';
import { createApi, ApiError, readList, isJob } from '../src/api';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
beforeEach(() => jest.clearAllMocks());

const vehicle = { id: 'vehicle-1', label: 'Family car', type: 'car' };
function customerApi() {
  return jest.fn(async (path: string) => (path === '/vehicles' ? [vehicle] : []));
}
async function requestForm(api = customerApi()) {
  const ui = await render(
    <AppLocaleProvider initialLanguage="en">
      <Customer api={api} expired={jest.fn()} />
    </AppLocaleProvider>,
  );
  await waitFor(() => expect(ui.getByText('No requests yet.')).toBeOnTheScreen());
  await fireEvent.press(ui.getByRole('button', { name: 'Request help' }));
  await fireEvent.press(ui.getByRole('button', { name: 'Family car' }));
  await fireEvent.changeText(ui.getByLabelText('Service needed'), 'flat_tire');
  await fireEvent.changeText(ui.getByLabelText('Describe the problem'), 'Rear tire is flat');
  return ui;
}

it.each([
  { latitude: NaN, longitude: 90 },
  { latitude: 91, longitude: 90 },
  { latitude: 23, longitude: 181 },
])('rejects invalid native coordinates %j', async (coords) => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest
    .mocked(Location.getCurrentPositionAsync)
    .mockResolvedValue({ coords } as Location.LocationObject);
  const ui = await requestForm();
  await fireEvent.press(ui.getByRole('button', { name: 'Use my current location' }));
  await waitFor(() => expect(ui.getByRole('alert')).toHaveTextContent(/Location unavailable/));
  expect(ui.getByRole('button', { name: 'Send request' })).toBeDisabled();
});

it('discards an in-flight location after leaving the request form', async () => {
  let finish!: (location: Location.LocationObject) => void;
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const ui = await requestForm();
  await fireEvent.press(ui.getByRole('button', { name: 'Use my current location' }));
  await waitFor(() => expect(finish).toBeDefined());
  await fireEvent.press(ui.getByRole('button', { name: 'My requests' }));
  finish({ coords: { latitude: 23.75, longitude: 90.37 } } as Location.LocationObject);
  await waitFor(() => expect(ui.getByRole('button', { name: 'Refresh' })).toBeEnabled());
  await fireEvent.press(ui.getByRole('button', { name: 'Request help' }));
  expect(ui.queryByText(/Pickup coordinates/)).toBeNull();
  expect(ui.getByRole('button', { name: 'Send request' })).toBeDisabled();
});

it('validates request lengths before submission even when input exceeds the native limit', async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 23.75, longitude: 90.37 },
  } as Location.LocationObject);
  const ui = await requestForm();
  await fireEvent.press(ui.getByRole('button', { name: 'Use my current location' }));
  await waitFor(() => expect(ui.getByRole('button', { name: 'Send request' })).toBeEnabled());
  await fireEvent.changeText(ui.getByLabelText('Service needed'), 'x'.repeat(51));
  expect(ui.getByRole('button', { name: 'Send request' })).toBeDisabled();
  await fireEvent.changeText(ui.getByLabelText('Service needed'), 'flat_tire');
  await fireEvent.changeText(ui.getByLabelText('Describe the problem'), 'x'.repeat(1001));
  expect(ui.getByRole('button', { name: 'Send request' })).toBeDisabled();
});

it('does not claim the request list is empty when loading fails', async () => {
  const api = jest.fn(async () => {
    throw new Error('offline');
  });
  const ui = await render(
    <AppLocaleProvider initialLanguage="en">
      <Customer api={api} expired={jest.fn()} />
    </AppLocaleProvider>,
  );
  await waitFor(() => expect(ui.getByRole('alert')).toBeOnTheScreen());
  expect(ui.queryByText('No requests yet.')).toBeNull();
});
it('adds a vehicle and submits a request only after selecting a pickup', async () => {
  const vehicle = { id: 'vehicle-1', label: 'Family car', type: 'car' };
  let vehicles: object[] = [];
  const api = jest.fn(async (path: string, body?: object) => {
    if (path === '/vehicles' && body) {
      vehicles = [vehicle];
      return vehicle;
    }
    if (path === '/vehicles') return vehicles;
    if (path === '/service-requests/mine') return [];
    return {};
  });
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 23.75, longitude: 90.37 },
  } as Location.LocationObject);
  const ui = await render(
    <AppLocaleProvider initialLanguage="en">
      <Customer api={api} expired={jest.fn()} />
    </AppLocaleProvider>,
  );
  await waitFor(() => expect(ui.getByText('No requests yet.')).toBeOnTheScreen());
  await fireEvent.press(ui.getByRole('button', { name: 'Add vehicle' }));
  await fireEvent.changeText(ui.getByLabelText('Vehicle name'), 'Family car');
  await fireEvent.press(ui.getByRole('button', { name: 'Save vehicle' }));
  await waitFor(() => expect(ui.getByText('Where do you need help?')).toBeOnTheScreen());
  await fireEvent.press(ui.getByRole('button', { name: 'Family car' }));
  await fireEvent.changeText(ui.getByLabelText('Service needed'), 'flat_tire');
  await fireEvent.changeText(ui.getByLabelText('Describe the problem'), 'Rear tire is flat');
  expect(ui.getByRole('button', { name: 'Send request' })).toBeDisabled();
  await fireEvent.press(ui.getByRole('button', { name: 'Use my current location' }));
  await waitFor(() => expect(ui.getByRole('button', { name: 'Send request' })).toBeEnabled());
  await fireEvent.press(ui.getByRole('button', { name: 'Send request' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/service-requests', {
      vehicleId: 'vehicle-1',
      serviceType: 'flat_tire',
      description: 'Rear tire is flat',
      latitude: 23.75,
      longitude: 90.37,
    }),
  );
});
it('does not send a protected request without a session', async () => {
  const api = createApi('https://example.test', async () => undefined);
  await expect(api('/vehicles')).rejects.toEqual(new ApiError(401));
});
it.each(['denied', 'unavailable'])('allows recovery when location is %s', async (failure) => {
  const api = customerApi();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: failure !== 'denied' } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockRejectedValue(new Error('Location disabled'));
  const ui = await requestForm(api);
  await fireEvent.press(ui.getByRole('button', { name: 'Use my current location' }));
  await waitFor(() => expect(ui.getByRole('alert')).toHaveTextContent(/Location unavailable/));
  expect(ui.getByRole('button', { name: 'Send request' })).toBeDisabled();
  expect(api.mock.calls.some(([path]) => path === '/service-requests')).toBe(false);
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 23.75, longitude: 90.37 },
  } as Location.LocationObject);
  await fireEvent.press(ui.getByRole('button', { name: 'Use my current location' }));
  await waitFor(() => expect(ui.getByRole('button', { name: 'Send request' })).toBeEnabled());
  expect(ui.queryByRole('alert')).toBeNull();
});

it.each([
  'open',
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'paid',
  'cancelled',
])('shows permitted actions and private details for %s requests', async (status) => {
  let currentStatus = status;
  const api = jest.fn(async (path: string) => {
    if (path === '/vehicles') return [vehicle];
    if (path === '/service-requests/mine')
      return [
        {
          id: 'request-1',
          status: currentStatus,
          vehicle: { ...vehicle, registrationNumber: 'PRIVATE-REG' },
          serviceType: 'flat_tire',
          description: 'Private description',
          latitude: 23.75,
          longitude: 90.37,
          mechanic: { displayName: 'Rahim Auto Care' },
        },
      ];
    currentStatus = status === 'open' ? 'cancelled' : 'paid';
    return {};
  });
  const ui = await render(
    <AppLocaleProvider initialLanguage="en">
      <Customer api={api} expired={jest.fn()} />
    </AppLocaleProvider>,
  );
  await waitFor(() => expect(ui.getByText(status.replaceAll('_', ' '))).toBeOnTheScreen());
  expect(ui.queryByText('PRIVATE-REG')).toBeNull();
  expect(ui.queryByText('23.75, 90.37')).toBeNull();
  await fireEvent.press(ui.getByRole('button', { name: 'View details' }));
  expect(ui.getByText('PRIVATE-REG')).toBeOnTheScreen();
  expect(ui.getByText('23.75, 90.37')).toBeOnTheScreen();
  expect(ui.getByText('Rahim Auto Care')).toBeOnTheScreen();
  if (status === 'open' || status === 'completed') {
    await fireEvent.press(
      ui.getByRole('button', { name: status === 'open' ? 'Cancel request' : 'Confirm cash paid' }),
    );
    expect(api).not.toHaveBeenCalledWith(expect.stringContaining('/request-1/'), {});
    await fireEvent.press(ui.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(ui.getByText(status === 'open' ? 'cancelled' : 'paid')).toBeOnTheScreen(),
    );
    expect(api).toHaveBeenCalledWith(
      '/service-requests/request-1/' + (status === 'open' ? 'cancel' : 'confirm-cash-payment'),
      {},
    );
  } else {
    expect(ui.queryByRole('button', { name: 'Cancel request' })).toBeNull();
    expect(ui.queryByRole('button', { name: 'Confirm cash paid' })).toBeNull();
  }
});

it('expires the customer session when loading returns unauthorized', async () => {
  const expired = jest.fn();
  const api = jest.fn(async () => {
    throw new ApiError(401);
  });
  await render(
    <AppLocaleProvider initialLanguage="en">
      <Customer api={api} expired={expired} />
    </AppLocaleProvider>,
  );
  await waitFor(() => expect(expired).toHaveBeenCalled());
});
it('rejects malformed request lists before rendering', () => {
  expect(() => readList([{ status: 'unknown' }], isJob)).toThrow('Invalid server response');
});
