import { Inject } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, type OnGatewayInit } from '@nestjs/websockets';
import { decode } from 'jsonwebtoken';
import type { Namespace } from 'socket.io';
import { SupabaseJwtVerifier } from '../auth/supabase-jwt-verifier.service';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';

@WebSocketGateway({ namespace: '/jobs', transports: ['websocket'] })
export class JobEventsGateway implements OnGatewayInit {
  @WebSocketServer()
  private namespace!: Namespace;

  constructor(
    @Inject(SupabaseJwtVerifier) private readonly verifier: SupabaseJwtVerifier,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  afterInit(namespace: Namespace) {
    namespace.use((socket, next) => {
      void (async () => {
        const token: unknown = socket.handshake.auth.token;
        if (typeof token !== 'string' || token.length > 8192) throw new Error();
        const identity = await this.verifier.verifyAccessToken(token);
        const claims = decode(token);
        const expiry = typeof claims === 'object' ? claims?.exp : undefined;
        const remaining = typeof expiry === 'number' ? expiry * 1000 - Date.now() : 0;
        const user = await this.users.findById(identity.id);
        if (
          remaining <= 0 ||
          !user ||
          (user.role !== UserRole.CUSTOMER && user.role !== UserRole.MECHANIC)
        )
          throw new Error();

        await socket.join(identity.id);
        const timer = setTimeout(() => socket.disconnect(), Math.min(remaining, 2_147_483_647));
        socket.once('disconnect', () => clearTimeout(timer));
        next();
      })().catch(() => next(new Error('Unauthorized')));
    });
  }

  invalidate(recipient: string, job: { id: string; jobId: string; kind: string }) {
    this.namespace.to(recipient).emit('job:changed', job);
  }
}
