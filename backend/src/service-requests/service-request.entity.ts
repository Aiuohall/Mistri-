import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ServiceRequestStatus } from './service-request-status.enum';

@Entity({ name: 'service_requests' })
@Index('IDX_service_requests_customer_created_at', ['customerId', 'createdAt'])
@Index('IDX_service_requests_mechanic_status_created_at', ['mechanicId', 'status', 'createdAt'])
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId!: string;

  @Column({ name: 'mechanic_id', type: 'uuid', nullable: true })
  mechanicId!: string | null;

  @Column({ name: 'service_type', type: 'varchar', length: 50 })
  serviceType!: string;

  @Column({ type: 'varchar', length: 1000 })
  description!: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location!: object;

  @Column({
    type: 'enum',
    enum: ServiceRequestStatus,
    enumName: 'service_request_status_enum',
    default: ServiceRequestStatus.OPEN,
  })
  status!: ServiceRequestStatus;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
