import {
  Controller,
  Post,
  Body,
  Get,
  BadRequestException,
  Query,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user.id; // from JWT
    return this.service.getCurrentUser(userId);
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
