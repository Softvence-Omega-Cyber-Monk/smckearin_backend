import { UserEnum } from '@/common/enum/user.enum';
import { GetUser, Roles } from '@/core/jwt/jwt.decorator';
import { JwtAuthGuard, RolesGuard } from '@/core/jwt/jwt.guard';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('Foster Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserEnum.FOSTER, UserEnum.FOSTER_ADMIN)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({ summary: 'Get foster profile' })
  @Get()
  async getProfile(@GetUser('sub') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @ApiOperation({ summary: 'Update foster profile' })
  @Put()
  async updateProfile(
    @GetUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }

  @ApiOperation({ summary: 'Update foster password' })
  @Put('password')
  async updatePassword(
    @GetUser('sub') userId: string,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.profileService.updatePassword(userId, dto);
  }
}
