import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type { MechanicProfile } from './mechanic-profile.entity';
import { MechanicsService } from './mechanics.service';

describe('MechanicsService', () => {
  const userId = '5e50ac6e-0e81-4952-a6c4-c37fb936af5e';
  const createdAt = new Date('2026-11-19T00:00:00.000Z');
  const profile: MechanicProfile = {
    userId,
    displayName: 'Rahim Auto Care',
    bio: 'Roadside repairs',
    serviceTypes: ['car'],
    isOnline: true,
    currentLocation: { type: 'Point', coordinates: [90.3742, 23.7525] },
    locationUpdatedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  function setupRepository(): jest.Mocked<
    Pick<Repository<MechanicProfile>, 'create' | 'findOneBy' | 'query' | 'save'>
  > {
    return {
      create: jest.fn(),
      findOneBy: jest.fn(),
      query: jest.fn(),
      save: jest.fn(),
    };
  }

  it('creates a mechanic profile for a verified mechanic', async () => {
    const repository = setupRepository();
    const newProfile = {
      ...profile,
      isOnline: false,
      currentLocation: null,
      locationUpdatedAt: null,
    };
    repository.findOneBy.mockResolvedValue(null);
    repository.create.mockReturnValue(newProfile);
    repository.save.mockResolvedValue(newProfile);
    const service = new MechanicsService(repository as unknown as Repository<MechanicProfile>);

    await expect(
      service.upsertProfile(userId, {
        displayName: 'Rahim Auto Care',
        bio: 'Roadside repairs',
        serviceTypes: ['car'],
      }),
    ).resolves.toEqual({
      userId,
      displayName: 'Rahim Auto Care',
      bio: 'Roadside repairs',
      serviceTypes: ['car'],
      isOnline: false,
      locationUpdatedAt: null,
    });
  });

  it('clears the last location when a mechanic goes offline', async () => {
    const repository = setupRepository();
    repository.findOneBy.mockResolvedValue({ ...profile });
    repository.save.mockResolvedValue({
      ...profile,
      isOnline: false,
      currentLocation: null,
      locationUpdatedAt: null,
    });
    const service = new MechanicsService(repository as unknown as Repository<MechanicProfile>);

    await service.updateAvailability(userId, { isOnline: false });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isOnline: false,
        currentLocation: null,
        locationUpdatedAt: null,
      }),
    );
  });

  it('does not accept a location while the mechanic is offline', async () => {
    const repository = setupRepository();
    repository.findOneBy.mockResolvedValue({ ...profile, isOnline: false });
    const service = new MechanicsService(repository as unknown as Repository<MechanicProfile>);

    await expect(
      service.updateLocation(userId, { latitude: 23.7525, longitude: 90.3742 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.query).not.toHaveBeenCalled();
  });

  it('enforces the movement and interval rule through the database update', async () => {
    const repository = setupRepository();
    repository.findOneBy.mockResolvedValue(profile);
    repository.query.mockResolvedValue([]);
    const service = new MechanicsService(repository as unknown as Repository<MechanicProfile>);

    await expect(
      service.updateLocation(userId, { latitude: 23.7525, longitude: 90.3742 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.query).toHaveBeenCalledWith(expect.stringContaining('ST_Distance'), [
      90.3742,
      23.7525,
      userId,
      15,
      50,
    ]);
  });

  it('maps a spatial nearby search to safe public mechanic data', async () => {
    const repository = setupRepository();
    repository.query.mockResolvedValue([
      {
        user_id: userId,
        display_name: 'Rahim Auto Care',
        bio: 'Roadside repairs',
        service_types: ['car'],
        distance_meters: '371.7',
        location_updated_at: '2026-11-19T00:00:00.000Z',
      },
    ]);
    const service = new MechanicsService(repository as unknown as Repository<MechanicProfile>);

    await expect(service.findNearby({ latitude: 23.7525, longitude: 90.3742 })).resolves.toEqual([
      {
        userId,
        displayName: 'Rahim Auto Care',
        bio: 'Roadside repairs',
        serviceTypes: ['car'],
        distanceMeters: 372,
        locationUpdatedAt: '2026-11-19T00:00:00.000Z',
      },
    ]);
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining('ST_DWithin'),
      [90.3742, 23.7525, 5_000, 15, 20],
    );
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining('location_updated_at" >= NOW()'),
      [90.3742, 23.7525, 5_000, 15, 20],
    );
  });

  it('requires a profile for availability changes', async () => {
    const repository = setupRepository();
    repository.findOneBy.mockResolvedValue(null);
    const service = new MechanicsService(repository as unknown as Repository<MechanicProfile>);

    await expect(service.updateAvailability(userId, { isOnline: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
