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
export class ApiError extends Error {
  constructor(public status: number) {
    super('Request failed');
  }
}
export function createApi(base: string, token: () => Promise<string | undefined>) {
  return async (path: string, body?: object): Promise<unknown> => {
    const accessToken = await token();
    if (!accessToken) throw new ApiError(401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base.replace(/\/$/, '') + path, {
        method: body ? 'POST' : 'GET',
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
    Number.isFinite(j.latitude) &&
    Math.abs(j.latitude) <= 90 &&
    Number.isFinite(j.longitude) &&
    Math.abs(j.longitude) <= 180 &&
    (j.mechanic === null ||
      (typeof j.mechanic === 'object' && typeof j.mechanic?.displayName === 'string'))
  );
}
export function readList<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value) || !value.every(guard)) throw new Error('Invalid server response');
  return value;
}
