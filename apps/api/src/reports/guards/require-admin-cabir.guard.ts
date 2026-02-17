import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';

/**
 * SECURITY: This guard ensures that ONLY the user "admin_cabir" can access
 * reports endpoints. For any other user (or unauthenticated), we return 404
 * (Not Found) to hide the existence of the feature - not 403 (Forbidden).
 */
const ADMIN_CABIR_USERNAME = 'admin_cabir';

@Injectable()
export class RequireAdminCabirGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User missing = not authenticated (JWT failed or no token)
    if (!user) {
      throw new NotFoundException();
    }

    // Username must be exactly "admin_cabir"
    if (user.username !== ADMIN_CABIR_USERNAME) {
      throw new NotFoundException();
    }

    return true;
  }
}
