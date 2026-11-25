import {
  ApiError,
  createApi,
  isAvailableJob,
  isJob,
  isLocationUpdateResult,
  isMechanicProfile,
  isNearbyMechanic,
  isVehicle,
  readList,
} from '../src/api';

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

  it('supports explicit PUT and PATCH methods for mechanic mutations', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ isOnline: true }) });
    const api = createApi('https://api.example.com', async () => 'token');
    await api('/mechanics/me/profile', { displayName: 'Rahim', serviceTypes: ['car'] }, 'PUT');
    await api('/mechanics/me/availability', { isOnline: true }, 'PATCH');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
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

  it('validates mechanic profiles, nearby mechanics, location updates, and privacy-safe available jobs', () => {
    const profile = {
      userId: 'm1',
      displayName: 'Rahim Auto Care',
      bio: 'Roadside specialist',
      serviceTypes: ['car'],
      isOnline: true,
      locationUpdatedAt: '2026-11-25T10:00:00.000Z',
    };
    const nearby = {
      userId: 'm1',
      displayName: 'Rahim Auto Care',
      bio: null,
      serviceTypes: ['car', 'motorcycle'],
      distanceMeters: 420,
      locationUpdatedAt: '2026-11-25T10:00:00.000Z',
    };
    const available = {
      id: 'r1',
      status: 'open',
      serviceType: 'flat_tire',
      description: 'Front tire flat',
      vehicle: { label: 'Family car', type: 'car' },
      createdAt: '2026-11-25T10:00:00.000Z',
    };

    expect(isMechanicProfile(profile)).toBe(true);
    expect(isNearbyMechanic(nearby)).toBe(true);
    expect(isNearbyMechanic({ ...nearby, distanceMeters: -5 })).toBe(false);
    expect(isLocationUpdateResult({ locationUpdatedAt: '2026-11-25T10:00:00.000Z' })).toBe(true);
    expect(isAvailableJob(available)).toBe(true);
    expect(isAvailableJob({ ...available, latitude: 23.75 })).toBe(false);
    expect(
      isAvailableJob({
        ...available,
        vehicle: { ...available.vehicle, registrationNumber: 'DHAKA-12' },
      }),
    ).toBe(false);
  });
});
