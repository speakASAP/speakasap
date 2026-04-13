import type { AuthContextUser } from '../shared/auth.types';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthContextUser;
      rawBody?: Buffer;
    }
  }
}

export {};
