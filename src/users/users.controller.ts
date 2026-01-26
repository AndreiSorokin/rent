import { Controller, Post, Body, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

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
}
