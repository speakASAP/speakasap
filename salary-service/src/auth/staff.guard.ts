import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { isStaffUser } from '../shared/staff-access';

@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Salary staff permission required');
    }
    return true;
  }
}
