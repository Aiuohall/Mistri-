export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

export type Vehicle = {
  id: string;
  label: string;
  type: string;
  registrationNumber?: string | null;
};

export const statuses = [
  'open',
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'paid',
  'cancelled',
] as const;

export type RequestStatus = (typeof statuses)[number];

export type MechanicAction = 'start_travel' | 'arrive' | 'start_service' | 'complete';

export type Job = {
  id: string;
  status: RequestStatus;
  serviceType: string;
  description: string;
  latitude: number;
  longitude: number;
  vehicle: Vehicle;
  mechanic: { displayName: string } | null;
};

export type AvailableJob = {
  id: string;
  status: 'open';
  serviceType: string;
  description: string;
  vehicle: {
    label: string;
    type: string;
  };
  createdAt: string;
};

export type MechanicProfile = {
  userId: string;
  displayName: string;
  bio: string | null;
  serviceTypes: string[];
  isOnline: boolean;
  locationUpdatedAt: string | null;
};

export type NearbyMechanic = {
  userId: string;
  displayName: string;
  bio: string | null;
  serviceTypes: string[];
  distanceMeters: number;
  locationUpdatedAt: string;
};

export type LocationUpdateResult = {
  locationUpdatedAt: string;
};

export class ApiError extends Error {
  constructor(public status: number) {
    super('Request failed');
  }
}

export function createApi(base: string, token: () => Promise<string | undefined>) {
  return async (path: string, body?: object, method?: HttpMethod): Promise<unknown> => {
    const accessToken = await token();
    if (!accessToken) throw new ApiError(401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const httpMethod: HttpMethod = method ?? (body ? 'POST' : 'GET');
    try {
      const response = await fetch(base.replace(/\/$/, '') + path, {
        method: httpMethod,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new ApiError(response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };
}

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export function isVehicle(value: unknown): value is Vehicle {
  if (!value || typeof value !== 'object') return false;
  const v = value as Vehicle;
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.type === 'string' &&
    (v.registrationNumber == null || typeof v.registrationNumber === 'string')
  );
}

export function isJob(value: unknown): value is Job {
  if (!value || typeof value !== 'object') return false;
  const j = value as Job;
  return (
    typeof j.id === 'string' &&
    statuses.includes(j.status) &&
    isVehicle(j.vehicle) &&
    typeof j.description === 'string' &&
    typeof j.serviceType === 'string' &&
    isValidCoordinate(j.latitude, j.longitude) &&
    (j.mechanic === null ||
      (typeof j.mechanic === 'object' && typeof j.mechanic?.displayName === 'string'))
  );
}

export function isAvailableJob(value: unknown): value is AvailableJob {
  if (!value || typeof value !== 'object') return false;
  const j = value as AvailableJob & { latitude?: unknown; longitude?: unknown };
  const vehicle = j.vehicle as {
    label?: unknown;
    type?: unknown;
    registrationNumber?: unknown;
  } | null;
  return (
    typeof j.id === 'string' &&
    j.status === 'open' &&
    typeof j.serviceType === 'string' &&
    typeof j.description === 'string' &&
    typeof j.createdAt === 'string' &&
    Boolean(vehicle) &&
    typeof vehicle?.label === 'string' &&
    typeof vehicle?.type === 'string' &&
    j.latitude === undefined &&
    j.longitude === undefined &&
    vehicle?.registrationNumber === undefined
  );
}

export function isMechanicProfile(value: unknown): value is MechanicProfile {
  if (!value || typeof value !== 'object') return false;
  const p = value as MechanicProfile;
  return (
    typeof p.userId === 'string' &&
    typeof p.displayName === 'string' &&
    (p.bio === null || typeof p.bio === 'string') &&
    Array.isArray(p.serviceTypes) &&
    p.serviceTypes.every((item) => typeof item === 'string') &&
    typeof p.isOnline === 'boolean' &&
    (p.locationUpdatedAt === null || typeof p.locationUpdatedAt === 'string')
  );
}

export function isNearbyMechanic(value: unknown): value is NearbyMechanic {
  if (!value || typeof value !== 'object') return false;
  const m = value as NearbyMechanic;
  return (
    typeof m.userId === 'string' &&
    typeof m.displayName === 'string' &&
    (m.bio === null || typeof m.bio === 'string') &&
    Array.isArray(m.serviceTypes) &&
    m.serviceTypes.every((item) => typeof item === 'string') &&
    typeof m.distanceMeters === 'number' &&
    Number.isFinite(m.distanceMeters) &&
    m.distanceMeters >= 0 &&
    typeof m.locationUpdatedAt === 'string'
  );
}

export function isLocationUpdateResult(value: unknown): value is LocationUpdateResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as LocationUpdateResult;
  return typeof r.locationUpdatedAt === 'string';
}

export function readList<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value) || !value.every(guard)) throw new Error('Invalid server response');
  return value;
}
