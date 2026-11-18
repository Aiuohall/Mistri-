import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, type Repository } from 'typeorm';

import type { AuthenticatedIdentity } from '../auth/authenticated-identity.interface';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepository: Repository<User>) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async getOrCreateFromIdentity(identity: AuthenticatedIdentity): Promise<User> {
    const existingUser = await this.findById(identity.id);

    if (existingUser) {
      return this.updateEmailIfChanged(existingUser, identity.email);
    }

    const newUser = this.usersRepository.create({
      id: identity.id,
      email: identity.email ?? null,
      role: UserRole.CUSTOMER,
    });

    try {
      return await this.usersRepository.save(newUser);
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const concurrentUser = await this.findById(identity.id);
      if (!concurrentUser) {
        throw error;
      }

      return this.updateEmailIfChanged(concurrentUser, identity.email);
    }
  }

  private async updateEmailIfChanged(user: User, email: string | undefined): Promise<User> {
    if (!email || user.email === email) {
      return user;
    }

    user.email = email;
    return this.usersRepository.save(user);
  }

  private isUniqueViolation(
    error: unknown,
  ): error is QueryFailedError & { driverError: { code?: string } } {
    return (
      error instanceof QueryFailedError &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
