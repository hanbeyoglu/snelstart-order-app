import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getEffectivePermissions, type Permission } from '../permissions';
import { PERMISSION_KEY, PERMISSIONS_ANY_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<Permission>(PERMISSION_KEY, context.getHandler());
    const anyPermissions = this.reflector.get<Permission[]>(PERMISSIONS_ANY_KEY, context.getHandler());
    if (!permission && (!anyPermissions || anyPermissions.length === 0)) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException();
    const perms = getEffectivePermissions(user.role, user.permissions);

    if (anyPermissions?.length) {
      if (!anyPermissions.some((p) => perms.includes(p))) throw new ForbiddenException();
      return true;
    }

    if (!perms.includes(permission!)) throw new ForbiddenException();
    return true;
  }
}
