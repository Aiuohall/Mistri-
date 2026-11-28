import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type { MechanicProfile } from '../mechanics/mechanic-profile.entity';
import type { Vehicle } from '../vehicles/vehicle.entity';
import { VehicleType } from '../vehicles/vehicle-type.enum';
import { MechanicServiceRequestAction } from './mechanic-service-request-action.enum';
import type { ServiceRequest } from './service-request.entity';
import { ServiceRequestStatus } from './service-request-status.enum';
import { ServiceRequestsService } from './service-requests.service';

describe('ServiceRequestsService', () => {
  const customerId = '0e7ccbb2-6cf2-447e-a518-aea6438e58b5';
  const mechanicId = '5e50ac6e-0e81-4952-a6c4-c37fb936af5e';
  const vehicleId = '2db87f0c-edb8-4c21-a794-733c3ee71e54';
  const requestId = 'e3c4a1cf-0fa3-4d0d-a2a6-cb560c85b1ae';
  const createdAt = new Date('2026-11-20T00:00:00.000Z');
  const vehicle: Vehicle = {
    id: vehicleId,
    customerId,
    label: 'Family car',
    type: VehicleType.CAR,
    make: 'Toyota',
    model: 'Corolla',
    productionYear: 2019,
    registrationNumber: null,
    createdAt,
    updatedAt: createdAt,
  };
  const request: ServiceRequest = {
    id: requestId,
    customerId,
    vehicleId,
    mechanicId: null,
    commissionBps: null,
    serviceType: 'flat_tire',
    description: 'Rear-left tire is flat.',
    location: { type: 'Point', coordinates: [90.3742, 23.7525] },
    status: ServiceRequestStatus.OPEN,
    acceptedAt: null,
    completedAt: null,
    paidAt: null,
    cancelledAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  function serviceRequestRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: requestId,
      vehicle_id: vehicleId,
      mechanic_id: mechanicId,
      status: ServiceRequestStatus.ASSIGNED,
      service_type: 'flat_tire',
      description: 'Rear-left tire is flat.',
      latitude: '23.7525',
      longitude: '90.3742',
      vehicle_label: 'Family car',
      vehicle_type: VehicleType.CAR,
      vehicle_make: 'Toyota',
      vehicle_model: 'Corolla',
      vehicle_production_year: 2019,
      vehicle_registration_number: null,
      mechanic_display_name: 'Rahim Auto Care',
      accepted_at: '2026-11-20T00:01:00.000Z',
      completed_at: null,
      paid_at: null,
      cancelled_at: null,
      created_at: '2026-11-20T00:00:00.000Z',
      updated_at: '2026-11-20T00:01:00.000Z',
      ...overrides,
    };
  }

  function setupServiceRequestsRepository(): jest.Mocked<
    Pick<Repository<ServiceRequest>, 'create' | 'findOneBy' | 'query' | 'save'>
  > {
    return {
      create: jest.fn(),
      findOneBy: jest.fn(),
      query: jest.fn(),
      save: jest.fn(),
    };
  }

  function setupVehiclesRepository(): jest.Mocked<Pick<Repository<Vehicle>, 'findOneBy'>> {
    return { findOneBy: jest.fn() };
  }

  function setupMechanicsRepository(): jest.Mocked<Pick<Repository<MechanicProfile>, 'findOneBy'>> {
    return { findOneBy: jest.fn() };
  }

  it('creates an open request only for a vehicle owned by the customer', async () => {
    const requestsRepository = setupServiceRequestsRepository();
    const vehiclesRepository = setupVehiclesRepository();
    const mechanicsRepository = setupMechanicsRepository();
    vehiclesRepository.findOneBy.mockResolvedValue(vehicle);
    requestsRepository.create.mockReturnValue(request);
    requestsRepository.save.mockResolvedValue(request);
    requestsRepository.query.mockResolvedValue([
      serviceRequestRow({
        mechanic_id: null,
        status: 'open',
        mechanic_display_name: null,
        accepted_at: null,
      }),
    ]);
    const service = new ServiceRequestsService(
      requestsRepository as unknown as Repository<ServiceRequest>,
      vehiclesRepository as unknown as Repository<Vehicle>,
      mechanicsRepository as unknown as Repository<MechanicProfile>,
    );

    await expect(
      service.create(customerId, {
        vehicleId,
        serviceType: 'flat_tire',
        description: 'Rear-left tire is flat.',
        latitude: 23.7525,
        longitude: 90.3742,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: requestId,
        status: ServiceRequestStatus.OPEN,
        mechanic: null,
      }),
    );
    expect(requestsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        vehicleId,
        mechanicId: null,
        status: ServiceRequestStatus.OPEN,
        location: { type: 'Point', coordinates: [90.3742, 23.7525] },
      }),
    );
  });

  it('does not create a request for another customer’s vehicle', async () => {
    const requestsRepository = setupServiceRequestsRepository();
    const vehiclesRepository = setupVehiclesRepository();
    const mechanicsRepository = setupMechanicsRepository();
    vehiclesRepository.findOneBy.mockResolvedValue(null);
    const service = new ServiceRequestsService(
      requestsRepository as unknown as Repository<ServiceRequest>,
      vehiclesRepository as unknown as Repository<Vehicle>,
      mechanicsRepository as unknown as Repository<MechanicProfile>,
    );

    await expect(
      service.create(customerId, {
        vehicleId,
        serviceType: 'flat_tire',
        description: 'Rear-left tire is flat.',
        latitude: 23.7525,
        longitude: 90.3742,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(requestsRepository.create).not.toHaveBeenCalled();
  });

  it('accepts a request with a single conditional update for an online mechanic', async () => {
    const requestsRepository = setupServiceRequestsRepository();
    const vehiclesRepository = setupVehiclesRepository();
    const mechanicsRepository = setupMechanicsRepository();
    mechanicsRepository.findOneBy.mockResolvedValue({ isOnline: true } as MechanicProfile);
    requestsRepository.query
      .mockResolvedValueOnce([{ id: requestId }])
      .mockResolvedValueOnce([serviceRequestRow()]);
    const service = new ServiceRequestsService(
      requestsRepository as unknown as Repository<ServiceRequest>,
      vehiclesRepository as unknown as Repository<Vehicle>,
      mechanicsRepository as unknown as Repository<MechanicProfile>,
    );

    await expect(service.accept(mechanicId, requestId)).resolves.toEqual(
      expect.objectContaining({ id: requestId, status: ServiceRequestStatus.ASSIGNED }),
    );
    expect(requestsRepository.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND "status" = \'open\''),
      [mechanicId, requestId],
    );
  });

  it('requires the mechanic to be online before accepting', async () => {
    const requestsRepository = setupServiceRequestsRepository();
    const vehiclesRepository = setupVehiclesRepository();
    const mechanicsRepository = setupMechanicsRepository();
    mechanicsRepository.findOneBy.mockResolvedValue({ isOnline: false } as MechanicProfile);
    const service = new ServiceRequestsService(
      requestsRepository as unknown as Repository<ServiceRequest>,
      vehiclesRepository as unknown as Repository<Vehicle>,
      mechanicsRepository as unknown as Repository<MechanicProfile>,
    );

    await expect(service.accept(mechanicId, requestId)).rejects.toBeInstanceOf(BadRequestException);
    expect(requestsRepository.query).not.toHaveBeenCalled();
  });

  it('only shows an online mechanic the information needed to choose an open request', async () => {
    const requestsRepository = setupServiceRequestsRepository();
    const vehiclesRepository = setupVehiclesRepository();
    const mechanicsRepository = setupMechanicsRepository();
    mechanicsRepository.findOneBy.mockResolvedValue({ isOnline: true } as MechanicProfile);
    requestsRepository.query.mockResolvedValue([
      serviceRequestRow({
        mechanic_id: null,
        status: ServiceRequestStatus.OPEN,
        mechanic_display_name: null,
        accepted_at: null,
      }),
    ]);
    const service = new ServiceRequestsService(
      requestsRepository as unknown as Repository<ServiceRequest>,
      vehiclesRepository as unknown as Repository<Vehicle>,
      mechanicsRepository as unknown as Repository<MechanicProfile>,
    );

    await expect(service.listAvailableForMechanic(mechanicId)).resolves.toEqual([
      expect.objectContaining({
        id: requestId,
        status: ServiceRequestStatus.OPEN,
        vehicle: expect.not.objectContaining({ registrationNumber: expect.anything() }),
      }),
    ]);
    const [availableRequest] = await service.listAvailableForMechanic(mechanicId);
    expect(availableRequest).not.toHaveProperty('latitude');
    expect(availableRequest).not.toHaveProperty('longitude');
  });

  it('does not permit a mechanic to complete a request before service has started', async () => {
    const requestsRepository = setupServiceRequestsRepository();
    const vehiclesRepository = setupVehiclesRepository();
    const mechanicsRepository = setupMechanicsRepository();
    requestsRepository.query.mockResolvedValue([]);
    requestsRepository.findOneBy.mockResolvedValue({
      ...request,
      mechanicId,
      status: ServiceRequestStatus.ASSIGNED,
    });
    const service = new ServiceRequestsService(
      requestsRepository as unknown as Repository<ServiceRequest>,
      vehiclesRepository as unknown as Repository<Vehicle>,
      mechanicsRepository as unknown as Repository<MechanicProfile>,
    );

    await expect(
      service.transitionAsMechanic(mechanicId, requestId, {
        action: MechanicServiceRequestAction.COMPLETE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(requestsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('AND "status" = $4'),
      [
        ServiceRequestStatus.COMPLETED,
        requestId,
        mechanicId,
        ServiceRequestStatus.IN_PROGRESS,
        false,
      ],
    );
  });

  it('allows only the customer to confirm cash payment after completion', async () => {
    const requestsRepository = setupServiceRequestsRepository();
    const vehiclesRepository = setupVehiclesRepository();
    const mechanicsRepository = setupMechanicsRepository();
    requestsRepository.query.mockResolvedValueOnce([{ id: requestId }]).mockResolvedValueOnce([
      serviceRequestRow({
        status: ServiceRequestStatus.PAID,
        completed_at: '2026-11-20T00:02:00.000Z',
        paid_at: '2026-11-20T00:03:00.000Z',
      }),
    ]);
    const service = new ServiceRequestsService(
      requestsRepository as unknown as Repository<ServiceRequest>,
      vehiclesRepository as unknown as Repository<Vehicle>,
      mechanicsRepository as unknown as Repository<MechanicProfile>,
    );

    await expect(service.confirmCashPayment(customerId, requestId)).resolves.toEqual(
      expect.objectContaining({
        id: requestId,
        status: ServiceRequestStatus.PAID,
        paidAt: '2026-11-20T00:03:00.000Z',
      }),
    );
    expect(requestsRepository.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND "status" = \'completed\''),
      [requestId, customerId],
    );
  });
});
