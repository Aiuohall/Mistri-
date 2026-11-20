import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { VehicleType } from './vehicle-type.enum';

@Entity({ name: 'vehicles' })
@Index('IDX_vehicles_customer_created_at', ['customerId', 'createdAt'])
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ type: 'varchar', length: 100 })
  label!: string;

  @Column({ name: 'vehicle_type', type: 'enum', enum: VehicleType, enumName: 'vehicle_type_enum' })
  type!: VehicleType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  make!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({ name: 'production_year', type: 'smallint', nullable: true })
  productionYear!: number | null;

  @Column({ name: 'registration_number', type: 'varchar', length: 32, nullable: true })
  registrationNumber!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
