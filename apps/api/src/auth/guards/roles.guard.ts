import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../schemas/user.schema';

const ROLE_RANK: Record<UserRole, number> = {
  sales_rep: 1,
  admin: 2,
  super_admin: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userRank = ROLE_RANK[user?.role as UserRole] || 0;
    return requiredRoles.some((role) => userRank >= ROLE_RANK[role]);
  }
}
