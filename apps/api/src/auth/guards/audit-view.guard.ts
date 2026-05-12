import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { getEffectivePermissions } from '../permissions';

/**
 * Requires effective permission `audit.view` (from role defaults + user.permissions).
 * Used together with @Roles('sales_rep') so only staff (non-customer) can hit the controller.
 */
@Injectable()
export class AuditViewGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException();
    }
    const perms = getEffectivePermissions(user.role, user.permissions);
    if (!perms.includes('audit.view')) {
      throw new ForbiddenException();
    }
    return true;
  }
}
