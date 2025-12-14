import { GetUser, ValidateAdmin, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AuthGetProfileService } from '../services/auth-get-profile.service';
import { AuthUpdateProfileService } from '../services/auth-update-profile.service';

@ApiTags('Auth, Profile')
@Controller('auth')
export class AuthProfileController {
  constructor(
    private readonly authGetProfileService: AuthGetProfileService,
    private readonly authUpdateProfileService: AuthUpdateProfileService,
  ) {}

  @ApiOperation({ summary: 'Get User Profile' })
  @ApiBearerAuth()
  @Get('profile')
  @ValidateAuth()
  async getProfile(@GetUser('sub') userId: string) {
    return this.authGetProfileService.getProfile(userId);
  }

  @ApiOperation({ summary: 'Get User Profile by Email (Admin Only)' })
  @ApiBearerAuth()
  @Get('profile/:email')
  @ValidateAdmin()
  async getProfileByEmail(@Param('email') email: string) {
    return this.authGetProfileService.getProfileByEmail(email);
  }

  @ApiOperation({
    summary: 'Update Admin / Super Admin / Manager / Shelter Admin profile',
  })
  @ApiBearerAuth()
  @Patch()
  @ValidateAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @GetUser() authUser: JWTPayload,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authUpdateProfileService.updateProfile(authUser, dto, file);
  }
}
