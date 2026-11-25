import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Job } from '../src/api';
import { AppLocaleProvider } from '../src/i18n/app-locale';
import { JobConversation, JobReview } from '../src/job-engagement';

jest.mock('../src/auth', () => ({ apiUrl: '', auth: null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'df70bc95-5755-4460-8fce-4776049305c5' }));

const job: Job = {
  id: 'job-1',
  status: 'assigned',
  serviceType: 'tyre',
  description: 'Flat tyre',
  latitude: 23.75,
  longitude: 90.4,
  mechanic: { displayName: 'Mechanic' },
  vehicle: { id: 'vehicle-1', label: 'Car', type: 'car' },
};

it('reuses the message id when a failed send is retried', async () => {
  let delivered = false;
  let lostResponse = true;
  const message = {
    id: '1',
    body: 'On my way',
    senderId: 'mechanic',
    createdAt: '2026-11-26T00:00Z',
  };
  const api = jest.fn(async (_path: string, body?: object) => {
    if (!body) return { items: delivered ? [message] : [], nextCursor: null };
    delivered = true;
    if (lostResponse) {
      lostResponse = false;
      throw new Error('Lost response');
    }
    return message;
  });
  const screen = await render(
    <AppLocaleProvider initialLanguage="en">
      <JobConversation job={job} api={api} userId="mechanic" />
    </AppLocaleProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Open job chat' }));
  await fireEvent.changeText(screen.getByLabelText('Message'), 'On my way');
  await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() =>
    expect(screen.getByText('Could not complete that action. Try again.')).toBeOnTheScreen(),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(screen.getByText('On my way')).toBeOnTheScreen());
  const writes = api.mock.calls.filter(([, body]) => body);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
});

it('keeps completed chat read-only', async () => {
  const api = jest.fn(async () => ({ items: [], nextCursor: null }));
  const screen = await render(
    <AppLocaleProvider initialLanguage="en">
      <JobConversation job={{ ...job, status: 'completed' }} api={api} userId="mechanic" />
    </AppLocaleProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Open job chat' }));
  await waitFor(() =>
    expect(screen.getByText('This conversation is read-only.')).toBeOnTheScreen(),
  );
  expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();
});

it('submits a valid job rating and confirms completion', async () => {
  const api = jest.fn(async () => ({ rating: 5 }));
  const screen = await render(
    <AppLocaleProvider initialLanguage="en">
      <JobReview jobId={job.id} api={api} />
    </AppLocaleProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Review mechanic' }));
  expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Rating from 1 to 5'), '5');
  await fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
  await waitFor(() => expect(screen.getByText('Review submitted.')).toBeOnTheScreen());
  expect(api).toHaveBeenCalledWith('/service-requests/job-1/review', { rating: 5, comment: '' });
});
