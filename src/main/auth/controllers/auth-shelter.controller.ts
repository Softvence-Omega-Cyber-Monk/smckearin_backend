import { GetUser, ValidateShelterAdmin } from '@/core/jwt/jwt.decorator';
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
import { InviteShelterMemberDto } from '../dto/invite-shelter-member.dto';
import { ShelterRoleDto } from '../dto/shelter-role.dto';
import { AuthShelterService } from '../services/auth-shelter.service';

@ApiTags('Auth, Shelter Team')
@Controller('auth/shelter')
@ValidateShelterAdmin()
@ApiBearerAuth()
export class AuthShelterController {
  constructor(private readonly authShelterService: AuthShelterService) {}

  @Get('team')
  @ApiOperation({ summary: 'List all shelter team members' })
  async getTeam(@GetUser('sub') userId: string) {
    return this.authShelterService.getTeam(userId);
  }

  @Post('team/invite')
  @ApiOperation({ summary: 'Invite a new shelter member' })
  async inviteMember(
    @GetUser('sub') userId: string,
    @Body() dto: InviteShelterMemberDto,
  ) {
    return this.authShelterService.inviteMember(userId, dto);
  }

  @Patch('team/:id/role')
  @ApiOperation({ summary: 'Change member role' })
  async changeRole(
    @GetUser('sub') userId: string,
    @Param('id') memberId: string,
    @Query() dto: ShelterRoleDto,
  ) {
    return this.authShelterService.changeRole(userId, memberId, dto);
  }

  @Delete('team/:id')
  @ApiOperation({ summary: 'Remove a shelter member' })
  async removeMember(
    @GetUser('sub') userId: string,
    @Param('id') memberId: string,
  ) {
    return this.authShelterService.removeMember(userId, memberId);
  }
}
