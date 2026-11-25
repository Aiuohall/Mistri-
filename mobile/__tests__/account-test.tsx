import { act, render, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import { Text } from 'react-native';
import { Account } from '../src/account';
import { auth } from '../src/auth';
import { Customer } from '../src/customer';
import { AppLocaleProvider } from '../src/i18n/app-locale';
import { Mechanic } from '../src/mechanic';

jest.mock('../src/auth', () => ({
  apiUrl: 'https://api.example.com',
  auth: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));
jest.mock('../src/customer', () => ({ Customer: jest.fn(() => null) }));
jest.mock('../src/mechanic', () => ({ Mechanic: jest.fn(() => null) }));
jest.mock('../src/mechanic-location', () => ({
  stopMechanicBackgroundLocation: jest.fn().mockResolvedValue(undefined),
}));

const client = auth!.auth;
const session = { user: { id: 'customer-1' }, access_token: 'token' } as Session;
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
let sessionChanged: Parameters<typeof client.onAuthStateChange>[0];

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
  jest.mocked(client.getSession).mockResolvedValue({ data: { session }, error: null });
  jest.mocked(client.signOut).mockResolvedValue({ error: null });
  jest.mocked(client.onAuthStateChange).mockImplementation((callback) => {
    sessionChanged = callback;
    return { data: { subscription: { id: 'test', callback, unsubscribe: jest.fn() } } };
  });
  jest.mocked(Customer).mockImplementation(() => <Text>Customer area</Text>);
  jest.mocked(Mechanic).mockImplementation(() => <Text>Mechanic area</Text>);
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

async function account() {
  return render(
    <AppLocaleProvider initialLanguage="en">
      <Account />
    </AppLocaleProvider>,
  );
}

it('mounts the mechanic workflow for verified mechanic profiles', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ role: 'mechanic' }) });
  const ui = await account();
  await waitFor(() => expect(ui.getByText('Mechanic area')).toBeOnTheScreen());
  expect(Customer).not.toHaveBeenCalled();
});

it('keeps unsupported roles such as admin outside customer and mechanic routes', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ role: 'admin' }) });
  const ui = await account();
  await waitFor(() =>
    expect(
      ui.getByText('This app currently supports customer and mechanic accounts.'),
    ).toBeOnTheScreen(),
  );
  expect(Customer).not.toHaveBeenCalled();
  expect(Mechanic).not.toHaveBeenCalled();
});

it('returns to sign-in when the API rejects a restored session', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  const ui = await account();
  await waitFor(() => expect(ui.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen());
  expect(Customer).not.toHaveBeenCalled();
  expect(Mechanic).not.toHaveBeenCalled();
  expect(client.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

it('does not reuse a customer role when the authenticated user changes to a mechanic or admin', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ role: 'customer' }) });
  const ui = await account();
  await waitFor(() => expect(ui.getByText('Customer area')).toBeOnTheScreen());
  const priorCustomerRenders = jest.mocked(Customer).mock.calls.length;
  const previousApi = jest.mocked(Customer).mock.calls[0][0].api;
  const mechanicSession = { ...session, user: { id: 'mechanic-1' } } as Session;
  jest.mocked(client.getSession).mockResolvedValue({
    data: { session: mechanicSession },
    error: null,
  });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ role: 'mechanic' }) });
  await act(async () => sessionChanged('SIGNED_IN', mechanicSession));
  await waitFor(() => expect(ui.getByText('Mechanic area')).toBeOnTheScreen());
  expect(Customer).toHaveBeenCalledTimes(priorCustomerRenders);
  expect(ui.queryByText('Customer area')).toBeNull();
  const calls = fetchMock.mock.calls.length;
  await expect(previousApi('/vehicles')).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});
