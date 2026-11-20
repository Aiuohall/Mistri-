import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type { Vehicle } from './vehicle.entity';
import { VehicleType } from './vehicle-type.enum';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  const customerId = '0e7ccbb2-6cf2-447e-a518-aea6438e58b5';
  const otherCustomerId = '9ee3fe70-5e78-4726-a3ec-7a1cd7fa8d10';
  const createdAt = new Date('2026-11-20T00:00:00.000Z');
  const vehicle: Vehicle = {
    id: '2db87f0c-edb8-4c21-a794-733c3ee71e54',
    customerId,
    label: 'Family car',
    type: VehicleType.CAR,
    make: 'Toyota',
    model: 'Corolla',
    productionYear: 2019,
    registrationNumber: 'DHAKA METRO GA 12-3456',
    createdAt,
    updatedAt: createdAt,
  };

  function setupRepository(): jest.Mocked<
    Pick<Repository<Vehicle>, 'create' | 'find' | 'findOneBy' | 'save'>
  > {
    return {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };
  }

  it('creates a vehicle for the signed-in customer', async () => {
    const repository = setupRepository();
    repository.create.mockReturnValue(vehicle);
    repository.save.mockResolvedValue(vehicle);
    const service = new VehiclesService(repository as unknown as Repository<Vehicle>);

    await expect(
      service.create(customerId, {
        label: 'Family car',
        type: VehicleType.CAR,
        make: 'Toyota',
        model: 'Corolla',
        productionYear: 2019,
        registrationNumber: 'DHAKA METRO GA 12-3456',
      }),
    ).resolves.toEqual({
      id: vehicle.id,
      label: 'Family car',
      type: VehicleType.CAR,
      make: 'Toyota',
      model: 'Corolla',
      productionYear: 2019,
      registrationNumber: 'DHAKA METRO GA 12-3456',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ customerId }));
  });

  it('does not reveal a vehicle owned by another customer', async () => {
    const repository = setupRepository();
    repository.findOneBy.mockResolvedValue(null);
    const service = new VehiclesService(repository as unknown as Repository<Vehicle>);

    await expect(service.getForCustomer(otherCustomerId, vehicle.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findOneBy).toHaveBeenCalledWith({
      id: vehicle.id,
      customerId: otherCustomerId,
    });
  });
});
