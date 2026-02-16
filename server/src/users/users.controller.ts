import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  BadRequestException,
  Query,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user.id; // from JWT
    return this.service.getCurrentUser(userId);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  updateMyPassword(
    @Req() req: any,
    @Body()
    body: {
      currentPassword: string;
      newPassword: string;
    },
  ) {
    return this.service.updatePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Post()
  create(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('name') name?: string,
  ) {
    return this.service.create(email, password, name);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('search')
  @Permissions(Permission.INVITE_USERS)
  async searchByEmail(@Query('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const user = await this.service.findByEmail(email.trim().toLowerCase());
    if (!user) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
