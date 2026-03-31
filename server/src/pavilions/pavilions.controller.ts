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
  UploadedFiles,
  Query,
  Req,
} from '@nestjs/common';
import { PavilionsService } from './pavilions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission, Prisma } from '@prisma/client';
import { CreatePavilionDto } from './dto/create-pavilion.dto';
import { ReorderPavilionsDto } from './dto/reorder-pavilions.dto';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

const decodeUploadFileName = (value: string) => {
  try {
    const decoded = Buffer.from(value, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? value : decoded;
  } catch {
    return value;
  }
};

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
    @Req() req: any,
  ) {
    return this.service.create(storeId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.VIEW_PAVILIONS)
  findAll(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('groupId') groupId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('paginated') paginated?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('paymentStatusFirst') paymentStatusFirst?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.service.findAll(storeId, {
      search,
      status,
      category,
      groupId: groupId ? Number(groupId) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      paginated: paginated === 'true' || paginated === '1',
      sortBy: sortBy === 'paymentStatus' ? 'paymentStatus' : undefined,
      sortDir: sortDir === 'desc' ? 'desc' : 'asc',
      paymentStatusFirst:
        paymentStatusFirst === 'PAID' ||
        paymentStatusFirst === 'PARTIAL' ||
        paymentStatusFirst === 'UNPAID'
          ? paymentStatusFirst
          : undefined,
      paymentStatus:
        paymentStatus === 'PAID' ||
        paymentStatus === 'PARTIAL' ||
        paymentStatus === 'UNPAID'
          ? paymentStatus
          : undefined,
    });
  }

  @Patch('reorder')
  @Permissions(Permission.EDIT_PAVILIONS)
  reorder(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() dto: ReorderPavilionsDto,
    @Req() req: any,
  ) {
    return this.service.reorder(storeId, dto.orderedIds, req.user.id);
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
    @Req() req: any,
  ) {
    return this.service.update(storeId, pavilionId, data, req.user.id);
  }

  @Patch(':pavilionId/description')
  @Permissions('MANAGE_MEDIA' as Permission)
  updateDescription(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body() data: { description?: string | null },
    @Req() req: any,
  ) {
    return this.service.updateDescription(
      storeId,
      pavilionId,
      data.description ?? null,
      req.user.id,
    );
  }

  @Post(':pavilionId/image')
  @Permissions('MANAGE_MEDIA' as Permission)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'pavilion-media');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const decodedOriginalName = decodeUploadFileName(file.originalname);
          cb(null, `${unique}${extname(decodedOriginalName)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('Поддерживаются только изображения JPG, PNG и WEBP'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Файл изображения обязателен');
    }

    return this.service.updateImage(
      storeId,
      pavilionId,
      `/uploads/pavilion-media/${file.filename}`,
      req.user.id,
    );
  }

  @Delete(':pavilionId/image')
  @Permissions('MANAGE_MEDIA' as Permission)
  deleteImage(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Req() req: any,
  ) {
    return this.service.deleteImage(storeId, pavilionId, req.user.id);
  }

  @Get(':pavilionId/media')
  @Permissions('MANAGE_MEDIA' as Permission)
  listMedia(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Req() req: any,
  ) {
    return this.service.listMedia(storeId, pavilionId, req.user.id);
  }

  @Post(':pavilionId/media')
  @Permissions('MANAGE_MEDIA' as Permission)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'files', maxCount: 20 }], {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'pavilion-media');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const decodedOriginalName = decodeUploadFileName(file.originalname);
          cb(null, `${unique}${extname(decodedOriginalName)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('Поддерживаются только изображения JPG, PNG и WEBP'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @UploadedFiles() files: { files?: any[] },
    @Req() req: any,
  ) {
    const uploaded = files?.files || [];
    if (uploaded.length === 0) {
      throw new BadRequestException('Нужно выбрать хотя бы одно изображение');
    }

    return this.service.addImages(
      storeId,
      pavilionId,
      uploaded.map((file) => `/uploads/pavilion-media/${file.filename}`),
      req.user.id,
    );
  }

  @Delete(':pavilionId/media/:imageId')
  @Permissions('MANAGE_MEDIA' as Permission)
  deleteMediaItem(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() req: any,
  ) {
    return this.service.deleteMediaItem(storeId, pavilionId, imageId, req.user.id);
  }

  @Delete(':pavilionId')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @Permissions(Permission.DELETE_PAVILIONS)
  delete(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Req() req: any,
  ) {
    return this.service.delete(storeId, pavilionId, req.user.id);
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
          const decodedOriginalName = decodeUploadFileName(file.originalname);
          cb(null, `${unique}${extname(decodedOriginalName)}`);
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
    @Body() body: { contractNumber?: string; expiresOn?: string },
    @UploadedFile() file?: any,
    @Req() req?: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const decodedOriginalName = decodeUploadFileName(file.originalname);

    return this.service.createContract(storeId, pavilionId, {
      fileName: decodedOriginalName,
      fileType: file.mimetype,
      filePath: `/uploads/contracts/${file.filename}`,
      contractNumber: body?.contractNumber,
      expiresOn: body?.expiresOn,
    }, req?.user?.id);
  }

  @Delete(':pavilionId/contracts/:contractId')
  @Permissions(Permission.DELETE_CONTRACTS)
  deleteContract(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
    @Req() req: any,
  ) {
    return this.service.deleteContract(storeId, pavilionId, contractId, req.user.id);
  }
}
