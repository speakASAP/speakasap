import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'certification_roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
