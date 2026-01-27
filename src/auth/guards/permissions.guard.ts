import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '@prisma/client';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Invalid access');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    let storeId = Number(request.params.storeId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!storeId && request.params.pavilionId) {
      const pavilion = await this.prisma.pavilion.findUnique({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        where: { id: Number(request.params.pavilionId) },
        select: { storeId: true },
      });

      if (!pavilion) {
        throw new ForbiddenException('Pavilion not found');
      }

      storeId = pavilion.storeId;
    }

    if (!storeId) {
      throw new ForbiddenException('Invalid access');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          userId: user.id,
          storeId,
        },
      },
    });

    if (!storeUser) {
      throw new ForbiddenException('User not part of this store');
    }

    const hasPermission = requiredPermissions.every((permission) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      storeUser.permissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
