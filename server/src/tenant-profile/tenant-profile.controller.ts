import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantProfileService } from './tenant-profile.service';

@Controller('tenant-profile')
@UseGuards(JwtAuthGuard)
export class TenantProfileController {
  constructor(private readonly tenantProfileService: TenantProfileService) {}

  @Get('me')
  getMyProfile(@Req() req: any) {
    return this.tenantProfileService.getMyProfile(req.user.id);
  }

  @Patch('me')
  updateMyProfile(
    @Req() req: any,
    @Body()
    body: {
      fullName?: string | null;
      phone?: string | null;
      requisites?: string | null;
    },
  ) {
    return this.tenantProfileService.updateMyProfile(req.user.id, body);
  }

  @Post('me/organizations')
  createOrganization(
    @Req() req: any,
    @Body()
    body:
      | {
          type: 'IE';
          fullName: string;
          inn?: string | null;
          ogrnip?: string | null;
          legalAddress?: string | null;
        }
      | {
          type: 'LLC';
          companyName: string;
          inn?: string | null;
          kpp?: string | null;
          ogrn?: string | null;
          legalAddress?: string | null;
        },
  ) {
    return this.tenantProfileService.createOrganization(req.user.id, body);
  }

  @Patch('me/organizations/:organizationId')
  updateOrganization(
    @Req() req: any,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body()
    body: {
      fullName?: string | null;
      companyName?: string | null;
      inn?: string | null;
      ogrnip?: string | null;
      kpp?: string | null;
      ogrn?: string | null;
      legalAddress?: string | null;
    },
  ) {
    return this.tenantProfileService.updateOrganization(
      req.user.id,
      organizationId,
      body,
    );
  }

  @Delete('me/organizations/:organizationId')
  deleteOrganization(
    @Req() req: any,
    @Param('organizationId', ParseIntPipe) organizationId: number,
  ) {
    return this.tenantProfileService.deleteOrganization(req.user.id, organizationId);
  }
}
