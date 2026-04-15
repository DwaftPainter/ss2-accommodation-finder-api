import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret =
      process.env.JWT_SECRET_KEY ??
      (() => {
        throw new Error('JWT_SECRET_KEY is not defined');
      })();
    console.log('JWT Strategy secret:', secret); // ← add this
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    console.log('Incoming JWT payload:', payload);
    if (!payload?.sub) throw new UnauthorizedException();
    return { userId: payload.sub };
  }
}
