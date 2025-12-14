import { ValidateSuperAdmin } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRoleDto } from '../dto/admin-role.dto';
import { InviteAdminDto } from '../dto/invite-admin.dto';
import { AuthAdminService } from '../services/auth-admin.service';

@ApiTags('Auth, Admin Management')
@Controller('auth/admin')
@ValidateSuperAdmin()
@ApiBearerAuth()
export class AuthAdminController {
  constructor(private readonly authAdminService: AuthAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get all admin users' })
  async getAdmins() {
    return this.authAdminService.getAdmins();
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a new admin or super admin' })
  async inviteAdmin(@Body() dto: InviteAdminDto) {
    return this.authAdminService.inviteAdmin(dto);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Change user role (Admin <-> Super Admin)' })
  async changeRole(@Param('id') id: string, @Query() dto: AdminRoleDto) {
    return this.authAdminService.changeRole(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an admin user' })
  async deleteAdmin(@Param('id') id: string) {
    return this.authAdminService.deleteAdmin(id);
  }
}
