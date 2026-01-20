import { Controller, Post, Body, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post('admin')
  createAdmin(@Body() data: Prisma.UserCreateInput) {
    return this.service.createAdmin(data);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
