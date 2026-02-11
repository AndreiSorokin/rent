import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { PavilionsService } from './pavilions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission, Prisma } from '@prisma/client';
import { CreatePavilionDto } from './dto/create-pavilion.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/pavilions')
export class PavilionsController {
  constructor(private readonly service: PavilionsService) {}

  @Post()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @Permissions(Permission.CREATE_PAVILIONS)
  create(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() dto: CreatePavilionDto,
  ) {
    return this.service.create(storeId, dto);
  }

  @Get()
  @Permissions(Permission.VIEW_PAVILIONS)
  findAll(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.findAll(storeId);
  }

  @Get(':pavilionId')
  @Permissions(Permission.VIEW_PAVILIONS)
  findOne(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
  ) {
    return this.service.findOne(storeId, pavilionId);
  }

  @Patch(':pavilionId')
  @Permissions(Permission.EDIT_PAVILIONS)
  update(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body() data: Prisma.PavilionUpdateInput,
  ) {
    return this.service.update(storeId, pavilionId, data);
  }

  @Delete(':pavilionId')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @Permissions(Permission.DELETE_PAVILIONS)
  delete(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
  ) {
    return this.service.delete(storeId, pavilionId);
  }

  @Get(':pavilionId/contracts')
  @Permissions(Permission.VIEW_CONTRACTS)
  listContracts(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
  ) {
    return this.service.listContracts(storeId, pavilionId);
  }

  @Post(':pavilionId/contracts')
  @Permissions(Permission.UPLOAD_CONTRACTS)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'contracts');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|jpg|jpeg|png)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(
            new BadRequestException('Unsupported file type'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadContract(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @UploadedFile() file?: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.service.createContract(storeId, pavilionId, {
      fileName: file.originalname,
      fileType: file.mimetype,
      filePath: `/uploads/contracts/${file.filename}`,
    });
  }

  @Delete(':pavilionId/contracts/:contractId')
  @Permissions(Permission.DELETE_CONTRACTS)
  deleteContract(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.service.deleteContract(storeId, pavilionId, contractId);
  }
}
