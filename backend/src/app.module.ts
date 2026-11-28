import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import type { EnvironmentVariables } from './config/environment.validation';
import { HealthController } from './health/health.controller';
import { EngagementModule } from './job-engagement/engagement.module';
import { SettlementController } from './settlement/settlement.controller';
import { SettlementService } from './settlement/settlement.service';
import { ManualBkashProvider, TopupProvider } from './settlement/topup-provider';
import { MechanicsModule } from './mechanics/mechanics.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { validateEnvironment } from './config/environment.validation';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        ssl: config.getOrThrow<boolean>('DATABASE_SSL') ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    UsersModule,
    AuthModule,
    MechanicsModule,
    VehiclesModule,
    ServiceRequestsModule,
    EngagementModule,
  ],
  controllers: [HealthController, SettlementController],
  providers: [SettlementService, { provide: TopupProvider, useClass: ManualBkashProvider }],
})
export class AppModule {}
