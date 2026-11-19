import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseJwtVerifier } from './supabase-jwt-verifier.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [SupabaseJwtVerifier, SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseJwtVerifier, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
