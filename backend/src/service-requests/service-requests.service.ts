import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { MechanicProfile } from '../mechanics/mechanic-profile.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import type { VehicleType } from '../vehicles/vehicle-type.enum';
import type { CreateServiceRequestDto } from './dto/create-service-request.dto';
import type {
  AvailableServiceRequestResponse,
  ServiceRequestResponse,
} from './dto/service-request.response';
import type { TransitionServiceRequestDto } from './dto/transition-service-request.dto';
import { MechanicServiceRequestAction } from './mechanic-service-request-action.enum';
import { ServiceRequest } from './service-request.entity';
import { ServiceRequestStatus } from './service-request-status.enum';

const REQUESTS_PAGE_SIZE = 50;

interface ServiceRequestRow {
  id: string;
  vehicle_id: string;
  mechanic_id: string | null;
  status: ServiceRequestStatus;
  service_type: string;
  description: string;
  latitude: number | string;
  longitude: number | string;
  vehicle_label: string;
  vehicle_type: VehicleType;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_production_year: number | string | null;
  vehicle_registration_number: string | null;
  mechanic_display_name: string | null;
  accepted_at: Date | string | null;
  completed_at: Date | string | null;
  paid_at: Date | string | null;
  cancelled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface UpdatedRequestRow {
  id: string;
}

interface MechanicTransition {
  from: ServiceRequestStatus;
  to: ServiceRequestStatus;
}

const MECHANIC_TRANSITIONS: Record<MechanicServiceRequestAction, MechanicTransition> = {
  [MechanicServiceRequestAction.START_TRAVEL]: {
    from: ServiceRequestStatus.ASSIGNED,
    to: ServiceRequestStatus.EN_ROUTE,
  },
  [MechanicServiceRequestAction.ARRIVE]: {
    from: ServiceRequestStatus.EN_ROUTE,
    to: ServiceRequestStatus.ARRIVED,
  },
  [MechanicServiceRequestAction.START_SERVICE]: {
    from: ServiceRequestStatus.ARRIVED,
    to: ServiceRequestStatus.IN_PROGRESS,
  },
  [MechanicServiceRequestAction.COMPLETE]: {
    from: ServiceRequestStatus.IN_PROGRESS,
    to: ServiceRequestStatus.COMPLETED,
  },
};

const REQUEST_SELECT = `
  SELECT
    sr."id",
    sr."vehicle_id",
    sr."mechanic_id",
    sr."status",
    sr."service_type",
    sr."description",
    ST_Y(sr."location"::geometry) AS "latitude",
    ST_X(sr."location"::geometry) AS "longitude",
    v."label" AS "vehicle_label",
    v."vehicle_type" AS "vehicle_type",
    v."make" AS "vehicle_make",
    v."model" AS "vehicle_model",
    v."production_year" AS "vehicle_production_year",
    v."registration_number" AS "vehicle_registration_number",
    m."display_name" AS "mechanic_display_name",
    sr."accepted_at",
    sr."completed_at",
    sr."paid_at",
    sr."cancelled_at",
    sr."created_at",
    sr."updated_at"
  FROM "service_requests" sr
  INNER JOIN "vehicles" v ON v."id" = sr."vehicle_id"
  LEFT JOIN "mechanics" m ON m."user_id" = sr."mechanic_id"
`;

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectRepository(ServiceRequest)
    private readonly serviceRequestsRepository: Repository<ServiceRequest>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(MechanicProfile)
    private readonly mechanicsRepository: Repository<MechanicProfile>,
  ) {}

  async create(customerId: string, dto: CreateServiceRequestDto): Promise<ServiceRequestResponse> {
    const vehicle = await this.vehiclesRepository.findOneBy({ id: dto.vehicleId, customerId });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    const request = this.serviceRequestsRepository.create({
      customerId,
      vehicleId: vehicle.id,
      mechanicId: null,
      serviceType: dto.serviceType,
      description: dto.description,
      location: {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      },
      status: ServiceRequestStatus.OPEN,
      acceptedAt: null,
      completedAt: null,
      paidAt: null,
      cancelledAt: null,
    });
    const savedRequest = await this.serviceRequestsRepository.save(request);

    return this.getForParticipant(customerId, savedRequest.id);
  }

  async listForCustomer(customerId: string): Promise<ServiceRequestResponse[]> {
    const rows = await this.serviceRequestsRepository.query<ServiceRequestRow[]>(
      `${REQUEST_SELECT}
       WHERE sr."customer_id" = $1
       ORDER BY sr."created_at" DESC
       LIMIT $2`,
      [customerId, REQUESTS_PAGE_SIZE],
    );

    return rows.map((row) => this.toResponse(row));
  }

  async listAvailableForMechanic(mechanicId: string): Promise<AvailableServiceRequestResponse[]> {
    const profile = await this.mechanicsRepository.findOneBy({ userId: mechanicId });
    if (!profile?.isOnline) {
      throw new BadRequestException('Go online before browsing service requests.');
    }

    const rows = await this.serviceRequestsRepository.query<ServiceRequestRow[]>(
      `${REQUEST_SELECT}
       WHERE sr."status" = 'open'
       ORDER BY sr."created_at" ASC
       LIMIT $1`,
      [REQUESTS_PAGE_SIZE],
    );

    return rows.map((row) => this.toAvailableResponse(row));
  }

  async listAssignedToMechanic(mechanicId: string): Promise<ServiceRequestResponse[]> {
    const rows = await this.serviceRequestsRepository.query<ServiceRequestRow[]>(
      `${REQUEST_SELECT}
       WHERE sr."mechanic_id" = $1
       ORDER BY sr."updated_at" DESC
       LIMIT $2`,
      [mechanicId, REQUESTS_PAGE_SIZE],
    );

    return rows.map((row) => this.toResponse(row));
  }

  async getForParticipant(userId: string, requestId: string): Promise<ServiceRequestResponse> {
    const rows = await this.serviceRequestsRepository.query<ServiceRequestRow[]>(
      `${REQUEST_SELECT}
       WHERE sr."id" = $1
         AND (sr."customer_id" = $2 OR sr."mechanic_id" = $2)`,
      [requestId, userId],
    );
    const request = rows[0];
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }

    return this.toResponse(request);
  }

  async accept(mechanicId: string, requestId: string): Promise<ServiceRequestResponse> {
    const profile = await this.mechanicsRepository.findOneBy({ userId: mechanicId });
    if (!profile?.isOnline) {
      throw new BadRequestException('Go online before accepting a service request.');
    }

    const updated = await this.serviceRequestsRepository.query<UpdatedRequestRow[]>(
      `
        UPDATE "service_requests"
        SET
          "mechanic_id" = $1,
          "status" = 'assigned',
          "accepted_at" = NOW(),
          "updated_at" = NOW()
        WHERE "id" = $2
          AND "status" = 'open'
          AND "mechanic_id" IS NULL
        RETURNING "id"
      `,
      [mechanicId, requestId],
    );

    if (!updated[0]) {
      await this.throwAcceptanceFailure(requestId);
    }

    return this.getForParticipant(mechanicId, requestId);
  }

  async transitionAsMechanic(
    mechanicId: string,
    requestId: string,
    dto: TransitionServiceRequestDto,
  ): Promise<ServiceRequestResponse> {
    const transition = MECHANIC_TRANSITIONS[dto.action];
    const completedAtUpdate =
      transition.to === ServiceRequestStatus.COMPLETED ? 'NOW()' : '"completed_at"';
    const updated = await this.serviceRequestsRepository.query<UpdatedRequestRow[]>(
      `
        UPDATE "service_requests"
        SET
          "status" = $1,
          "completed_at" = ${completedAtUpdate},
          "updated_at" = NOW()
        WHERE "id" = $2
          AND "mechanic_id" = $3
          AND "status" = $4
        RETURNING "id"
      `,
      [transition.to, requestId, mechanicId, transition.from],
    );

    if (!updated[0]) {
      await this.throwMechanicTransitionFailure(mechanicId, requestId, dto.action);
    }

    return this.getForParticipant(mechanicId, requestId);
  }

  async cancel(customerId: string, requestId: string): Promise<ServiceRequestResponse> {
    const updated = await this.serviceRequestsRepository.query<UpdatedRequestRow[]>(
      `
        UPDATE "service_requests"
        SET
          "status" = 'cancelled',
          "cancelled_at" = NOW(),
          "updated_at" = NOW()
        WHERE "id" = $1
          AND "customer_id" = $2
          AND "status" = 'open'
        RETURNING "id"
      `,
      [requestId, customerId],
    );

    if (!updated[0]) {
      await this.throwCancellationFailure(customerId, requestId);
    }

    return this.getForParticipant(customerId, requestId);
  }

  async confirmCashPayment(customerId: string, requestId: string): Promise<ServiceRequestResponse> {
    const updated = await this.serviceRequestsRepository.query<UpdatedRequestRow[]>(
      `
        UPDATE "service_requests"
        SET
          "status" = 'paid',
          "paid_at" = NOW(),
          "updated_at" = NOW()
        WHERE "id" = $1
          AND "customer_id" = $2
          AND "status" = 'completed'
        RETURNING "id"
      `,
      [requestId, customerId],
    );

    if (!updated[0]) {
      await this.throwPaymentConfirmationFailure(customerId, requestId);
    }

    return this.getForParticipant(customerId, requestId);
  }

  private async throwAcceptanceFailure(requestId: string): Promise<never> {
    const request = await this.serviceRequestsRepository.findOneBy({ id: requestId });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }

    throw new ConflictException('This service request is no longer available.');
  }

  private async throwMechanicTransitionFailure(
    mechanicId: string,
    requestId: string,
    action: MechanicServiceRequestAction,
  ): Promise<never> {
    const request = await this.serviceRequestsRepository.findOneBy({ id: requestId });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }
    if (request.mechanicId !== mechanicId) {
      throw new NotFoundException('Service request not found.');
    }

    throw new ConflictException(
      `Cannot ${action.replace('_', ' ')} while the request is ${request.status}.`,
    );
  }

  private async throwCancellationFailure(customerId: string, requestId: string): Promise<never> {
    const request = await this.serviceRequestsRepository.findOneBy({ id: requestId, customerId });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }

    throw new ConflictException(`Cannot cancel a request that is ${request.status}.`);
  }

  private async throwPaymentConfirmationFailure(
    customerId: string,
    requestId: string,
  ): Promise<never> {
    const request = await this.serviceRequestsRepository.findOneBy({ id: requestId, customerId });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }

    throw new ConflictException(
      `Cannot confirm cash payment while the request is ${request.status}.`,
    );
  }

  private toAvailableResponse(row: ServiceRequestRow): AvailableServiceRequestResponse {
    return {
      id: row.id,
      status: ServiceRequestStatus.OPEN,
      serviceType: row.service_type,
      description: row.description,
      vehicle: {
        label: row.vehicle_label,
        type: row.vehicle_type,
        make: row.vehicle_make,
        model: row.vehicle_model,
        productionYear:
          row.vehicle_production_year === null ? null : Number(row.vehicle_production_year),
      },
      createdAt: this.toIsoString(row.created_at),
    };
  }

  private toResponse(row: ServiceRequestRow): ServiceRequestResponse {
    return {
      id: row.id,
      status: row.status,
      serviceType: row.service_type,
      description: row.description,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      vehicle: {
        id: row.vehicle_id,
        label: row.vehicle_label,
        type: row.vehicle_type,
        make: row.vehicle_make,
        model: row.vehicle_model,
        productionYear:
          row.vehicle_production_year === null ? null : Number(row.vehicle_production_year),
        registrationNumber: row.vehicle_registration_number,
      },
      mechanic:
        row.mechanic_id && row.mechanic_display_name
          ? { id: row.mechanic_id, displayName: row.mechanic_display_name }
          : null,
      acceptedAt: this.toIsoStringOrNull(row.accepted_at),
      completedAt: this.toIsoStringOrNull(row.completed_at),
      paidAt: this.toIsoStringOrNull(row.paid_at),
      cancelledAt: this.toIsoStringOrNull(row.cancelled_at),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoStringOrNull(value: Date | string | null): string | null {
    return value === null ? null : this.toIsoString(value);
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
