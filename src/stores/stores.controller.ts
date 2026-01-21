import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Delete,
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

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
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
