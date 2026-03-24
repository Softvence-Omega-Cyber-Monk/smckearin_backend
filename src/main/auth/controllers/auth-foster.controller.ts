import { UserEnum } from '@/common/enum/user.enum';
import { GetUser, Public, ValidateAuth } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FosterRegisterDto } from '../dto/foster-register.dto';
import { FosterResetPasswordDto } from '../dto/foster-reset-password.dto';
import { ForgotPasswordDto } from '../dto/password.dto';
import { AuthFosterService } from '../services/auth-foster.service';

@ApiTags('Auth, Foster')
@Controller('auth/foster')
export class AuthFosterController {
  constructor(private readonly authFosterService: AuthFosterService) {}

  @ApiOperation({ summary: 'Register as foster' })
  @Public()
  @Post('register')
  async register(@Body() body: FosterRegisterDto) {
    return this.authFosterService.register(body);
  }

  @ApiOperation({ summary: 'Verify foster email' })
  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authFosterService.verifyEmail(token);
  }

  @ApiOperation({ summary: 'Send foster password reset link' })
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authFosterService.forgotPassword(body);
  }

  @ApiOperation({ summary: 'Reset foster password' })
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: FosterResetPasswordDto) {
    return this.authFosterService.resetPassword(body);
  }

  @ApiOperation({ summary: 'Get foster registration status' })
  @ApiBearerAuth()
  @Get('registration-status')
  @ValidateAuth(UserEnum.FOSTER, UserEnum.FOSTER_ADMIN)
  async getRegistrationStatus(@GetUser('sub') userId: string) {
    return this.authFosterService.getRegistrationStatus(userId);
  }
}
