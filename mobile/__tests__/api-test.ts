import { ApiError, createApi, isJob, isVehicle, readList } from '../src/api';

describe('API transport', () => {
  const fetchMock = jest.fn();
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = fetchMock;
    fetchMock.mockReset();
  });
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses the current session token for every request and serializes mutations', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'created' }) });
    const token = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('refreshed');
    const api = createApi('https://api.example.com/', token);
    await api('/vehicles');
    await expect(api('/vehicles', { label: 'Bike' })).resolves.toEqual({ id: 'created' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/vehicles');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer first');
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ label: 'Bike' }),
        headers: expect.objectContaining({ Authorization: 'Bearer refreshed' }),
      }),
    );
  });

  it('never sends a protected request without a session', async () => {
    await expect(
      createApi('https://api.example.com', async () => undefined)('/vehicles'),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 409, 500])('preserves HTTP %s for recoverable UI states', async (status) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    await expect(
      createApi('https://api.example.com', async () => 'token')('/vehicles'),
    ).rejects.toEqual(new ApiError(status));
  });
});

describe('API response validation', () => {
  const vehicle = { id: 'v1', label: 'Bike', type: 'bike' };
  const job = {
    id: 'r1',
    status: 'open',
    serviceType: 'engine',
    description: 'Needs repair',
    latitude: 23.7,
    longitude: 90.4,
    vehicle,
    mechanic: null,
  };

  it('accepts valid customer responses', () => {
    expect(readList([vehicle], isVehicle)).toEqual([vehicle]);
    expect(isJob(job)).toBe(true);
  });

  it('rejects malformed optional vehicle registration before rendering', () => {
    expect(isVehicle({ ...vehicle, registrationNumber: { unexpected: 'object' } })).toBe(false);
  });

  it('rejects invalid geographic coordinates and unknown status values', () => {
    expect(isJob({ ...job, latitude: 91 })).toBe(false);
    expect(isJob({ ...job, longitude: -181 })).toBe(false);
    expect(isJob({ ...job, status: 'unexpected' })).toBe(false);
  });

  it('rejects a malformed response instead of partially rendering it', () => {
    expect(() => readList([vehicle, null], isVehicle)).toThrow('Invalid server response');
  });
});
