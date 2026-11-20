import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { VehicleResponse } from './dto/vehicle.response';
import { Vehicle } from './vehicle.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
  ) {}

  async create(customerId: string, dto: CreateVehicleDto): Promise<VehicleResponse> {
    const vehicle = this.vehiclesRepository.create({
      customerId,
      label: dto.label,
      type: dto.type,
      make: dto.make ?? null,
      model: dto.model ?? null,
      productionYear: dto.productionYear ?? null,
      registrationNumber: dto.registrationNumber ?? null,
    });

    return this.toResponse(await this.vehiclesRepository.save(vehicle));
  }

  async listForCustomer(customerId: string): Promise<VehicleResponse[]> {
    const vehicles = await this.vehiclesRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });

    return vehicles.map((vehicle) => this.toResponse(vehicle));
  }

  async getForCustomer(customerId: string, vehicleId: string): Promise<VehicleResponse> {
    return this.toResponse(await this.getOwnedVehicleOrThrow(customerId, vehicleId));
  }

  async update(
    customerId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.getOwnedVehicleOrThrow(customerId, vehicleId);
    Object.assign(vehicle, {
      ...(dto.label === undefined ? {} : { label: dto.label }),
      ...(dto.type === undefined ? {} : { type: dto.type }),
      ...(dto.make === undefined ? {} : { make: dto.make }),
      ...(dto.model === undefined ? {} : { model: dto.model }),
      ...(dto.productionYear === undefined ? {} : { productionYear: dto.productionYear }),
      ...(dto.registrationNumber === undefined
        ? {}
        : { registrationNumber: dto.registrationNumber }),
    });

    return this.toResponse(await this.vehiclesRepository.save(vehicle));
  }

  private async getOwnedVehicleOrThrow(customerId: string, vehicleId: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOneBy({ id: vehicleId, customerId });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    return vehicle;
  }

  private toResponse(vehicle: Vehicle): VehicleResponse {
    return {
      id: vehicle.id,
      label: vehicle.label,
      type: vehicle.type,
      make: vehicle.make,
      model: vehicle.model,
      productionYear: vehicle.productionYear,
      registrationNumber: vehicle.registrationNumber,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
    };
  }
}
