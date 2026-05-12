import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getEffectivePermissions, type Permission } from '../permissions';
import { PERMISSION_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<Permission>(PERMISSION_KEY, context.getHandler());
    if (!permission) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException();
    const perms = getEffectivePermissions(user.role, user.permissions);
    if (!perms.includes(permission)) throw new ForbiddenException();
    return true;
  }
}
