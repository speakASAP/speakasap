import type { ValidatedUser } from '../auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: ValidatedUser;
    }
  }
}

export {};
