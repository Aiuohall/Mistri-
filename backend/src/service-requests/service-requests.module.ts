import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MechanicProfile } from '../mechanics/mechanic-profile.entity';
import { UsersModule } from '../users/users.module';
import { Vehicle } from '../vehicles/vehicle.entity';
import { ServiceRequest } from './service-request.entity';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceRequest, Vehicle, MechanicProfile]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
