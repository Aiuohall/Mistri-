import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MechanicProfile } from './mechanic-profile.entity';
import { MechanicsController } from './mechanics.controller';
import { MechanicsService } from './mechanics.service';

@Module({
  imports: [TypeOrmModule.forFeature([MechanicProfile]), AuthModule, UsersModule],
  controllers: [MechanicsController],
  providers: [MechanicsService],
})
export class MechanicsModule {}
