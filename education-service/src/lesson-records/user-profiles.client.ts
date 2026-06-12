import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type Profile = {
  id?: unknown;
  authUserId?: unknown;
};

@Injectable()
export class UserProfilesClient {
  private baseUrl(): string {
    return (process.env.USER_SERVICE_URL || '').replace(/\/$/, '');
  }

  async getTeacherId(token: string): Promise<number | null> {
    return this.getProfileId('/api/v1/teachers/me', token);
  }

  async getStudentId(token: string): Promise<number | null> {
    return this.getProfileId('/api/v1/students/me', token);
  }

  private async getProfileId(path: string, token: string): Promise<number | null> {
    const base = this.baseUrl();
    if (!base) {
      throw new ServiceUnavailableException('User service URL is not configured');
    }
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404 || res.status === 403) {
      return null;
    }
    if (!res.ok) {
      throw new ServiceUnavailableException('User service profile lookup failed');
    }
    const body = (await res.json()) as Profile;
    const id = Number(body.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
