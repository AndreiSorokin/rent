import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { Prisma } from '@prisma/client';

@Controller('stores')
export class StoresController {
  constructor(private readonly service: StoresService) {}

  @Post()
  create(@Body() data: Prisma.StoreCreateInput) {
    return this.service.create(data);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
