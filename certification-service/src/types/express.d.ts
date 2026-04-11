import type { JwtUser } from '../auth/jwt-user';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtUser;
  }
}

export {};
