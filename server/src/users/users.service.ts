import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '../auth/password-policy';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getCurrentUser(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        stores: {
          select: {
            permissions: true,
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async create(email: string, password: string, name?: string) {
    if (!isPasswordStrong(password)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const hashed = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
      },
    });
  }

  async updatePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException(
        'currentPassword and newPassword are required',
      );
    }

    if (!isPasswordStrong(newPassword)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const validCurrent = await bcrypt.compare(currentPassword, user.password);
    if (!validCurrent) {
      throw new BadRequestException('Current password is incorrect');
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (sameAsCurrent) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { success: true };
  }

  // Get all users
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }

  // Get users ny email
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  //TODO: list all users (for admin) with pagination/filter later
}
