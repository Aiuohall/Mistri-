import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';
import { JobEventsGateway } from './job-events.gateway';
import { JobOutbox } from './job-outbox.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [EngagementController],
  providers: [EngagementService, JobEventsGateway, JobOutbox],
})
export class EngagementModule {}
