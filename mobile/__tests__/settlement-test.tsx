import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Job } from '../src/api';
import { AppLocaleProvider } from '../src/i18n/app-locale';
import { JobPricing, Wallet, poisha } from '../src/settlement';

jest.mock('../src/auth', () => ({ apiUrl: '', auth: null }));
const job: Job = {
  id: 'job-1',
  priced: true,
  status: 'arrived',
  vehicle: { id: 'v', type: 'car', label: 'Car' },
  description: 'Tyre',
  serviceType: 'tyre',
  mechanic: { displayName: 'Mechanic' },
  latitude: 0,
  longitude: 0,
};
const quote = { id: 'q2', version: 2, amount: 10005, fee: 1001, accepted_at: null };
const old = { id: 'q1', version: 1, amount: 5000, fee: 500, accepted_at: '2026-11-28' };

it('parses whole taka and fractional poisha exactly in Bengali and English', () => {
  expect(poisha('১০০.০৫')).toBe(10005);
  expect(poisha('0.01')).toBe(1);
  expect(poisha('1000000.00')).toBe(100000000);
  for (const v of ['1000000.01', '0', '1.001', '-1', '1e2', '']) expect(poisha(v)).toBeNull();
});
it('shows agreed cash separately and accepts only the displayed replacement quote', async () => {
  const api = jest.fn().mockResolvedValue({ current: quote, accepted: old, needsTopup: true });
  const screen = await render(
    <AppLocaleProvider initialLanguage="en">
      <JobPricing job={job} api={api} role="customer" />
    </AppLocaleProvider>,
  );
  await screen.findByText('Agreed cash price ৳50.00');
  expect(screen.getByText('Proposed cash price #2 · ৳100.05')).toBeOnTheScreen();
  expect(screen.getByText('Commission paid by mechanic ৳10.01')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Accept this cash price' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/service-requests/job-1/quotes/q2/accept', {}),
  );
});
it('disables starting work until the current quote is accepted and funded', async () => {
  const api = jest.fn().mockResolvedValue({ current: old, accepted: old, needsTopup: true });
  const screen = await render(
    <AppLocaleProvider initialLanguage="en">
      <JobPricing job={job} api={api} role="mechanic" onStart={jest.fn()} />
    </AppLocaleProvider>,
  );
  await screen.findByText('Agreed cash price ৳50.00');
  expect(screen.getByRole('button', { name: 'Start work' })).toBeDisabled();
  api.mockResolvedValue({ current: old, accepted: old, needsTopup: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh pricing' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start work' })).toBeEnabled());
});
it('submits a test transfer and shows pending verification without increasing balance', async () => {
  const initial = { balance: '0', reserved: '0', entries: [], topups: [] };
  const pending = { id: 't1', reference: 'TEST123', amount: 1250, status: 'pending' };
  const api = jest
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce(pending)
    .mockResolvedValue({ ...initial, topups: [pending] });
  const screen = await render(
    <AppLocaleProvider initialLanguage="en">
      <Wallet api={api} />
    </AppLocaleProvider>,
  );
  await fireEvent.changeText(await screen.findByLabelText('Amount in taka'), '12.50');
  await fireEvent.changeText(screen.getByLabelText(/Test bKash reference/), 'test123');
  await fireEvent.press(screen.getByRole('button', { name: 'Submit test top-up' }));
  await screen.findByText('TEST123 · ৳12.50 · Pending verification');
  expect(api).toHaveBeenCalledWith('/wallet/me/topups', { amount: 1250, reference: 'TEST123' });
  expect(screen.getByText('Balance ৳0.00')).toBeOnTheScreen();
});
