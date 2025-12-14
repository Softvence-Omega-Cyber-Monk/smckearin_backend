import { UserEnum } from '@/common/enum/user.enum';
import { Roles } from '@/core/jwt/jwt.decorator';
import { JwtAuthGuard, RolesGuard } from '@/core/jwt/jwt.guard';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InviteAdminDto } from '../dto/invite-admin.dto';
import { AdminTeamService } from '../services/admin-team.service';

@ApiTags('Admin Team Management')
@Controller('admin/team')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminTeamController {
  constructor(private readonly adminTeamService: AdminTeamService) {}

  @Post('invite')
  @Roles(UserEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Invite a new admin or super admin' })
  async inviteAdmin(@Body() dto: InviteAdminDto) {
    return this.adminTeamService.inviteAdmin(dto);
  }
}
