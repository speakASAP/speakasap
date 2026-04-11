import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export type ViewTokenPayload = {
  k: 'cc' | 'ec';
  id: number;
  v: number;
};

@Injectable()
export class ViewTokenService {
  private readonly logger = new Logger(ViewTokenService.name);

  signCourseCertificate(id: number): string {
    return this.sign({ k: 'cc', id, v: 1 });
  }

  signEducationCertificate(id: number): string {
    return this.sign({ k: 'ec', id, v: 1 });
  }

  verify(token: string): ViewTokenPayload | null {
    const secret = process.env.CERT_VIEW_TOKEN_SECRET;
    if (!secret) {
      this.logger.error('CERT_VIEW_TOKEN_SECRET is not configured');
      return null;
    }
    try {
      const decoded = jwt.verify(token, secret) as ViewTokenPayload;
      if ((decoded.k !== 'cc' && decoded.k !== 'ec') || typeof decoded.id !== 'number') {
        return null;
      }
      return decoded;
    } catch (error) {
      this.logger.warn(`View token rejected: ${(error as Error).message}`);
      return null;
    }
  }

  private sign(payload: ViewTokenPayload): string {
    const secret = process.env.CERT_VIEW_TOKEN_SECRET;
    if (!secret) {
      throw new Error('CERT_VIEW_TOKEN_SECRET is not configured');
    }
    return jwt.sign(payload, secret, { expiresIn: '90d' });
  }
}
