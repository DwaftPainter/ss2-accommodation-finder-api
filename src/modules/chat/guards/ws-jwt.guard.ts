import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private logger: Logger = new Logger('WsJwtGuard');

  constructor(private jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn('No token provided');
      return false;
    }

    try {
      const payload = this.jwtService.verify(token);
      client['user'] = { userId: payload.sub };
      return true;
    } catch (error) {
      this.logger.warn('Invalid token');
      return false;
    }
  }

  private extractToken(client: Socket): string | null {
    // Try to get token from handshake auth
    const auth = client.handshake.auth;
    if (auth?.token) {
      return auth.token.replace('Bearer ', '');
    }

    // Try to get token from handshake query
    const query = client.handshake.query;
    if (query?.token) {
      const token = Array.isArray(query.token) ? query.token[0] : query.token;
      return token.replace('Bearer ', '');
    }

    // Try to get token from headers
    const headers = client.handshake.headers;
    if (headers?.authorization) {
      const auth = Array.isArray(headers.authorization)
        ? headers.authorization[0]
        : headers.authorization;
      return auth.replace('Bearer ', '');
    }

    return null;
  }
}
