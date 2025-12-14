import { GetUser, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto, RefreshTokenDto } from '../dto/logout.dto';
import { AuthLoginService } from '../services/auth-login.service';
import { AuthLogoutService } from '../services/auth-logout.service';

@ApiTags('Auth, Profile & Settings')
@Controller('auth')
export class AuthLoginController {
  constructor(
    private readonly authLoginService: AuthLoginService,
    private readonly authLogoutService: AuthLogoutService,
  ) {}

  @ApiOperation({ summary: 'User Login' })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authLoginService.login(body);
  }

  @ApiOperation({ summary: 'User Logout' })
  @ApiBearerAuth()
  @Post('logout')
  @ValidateAuth()
  async logOut(@GetUser('sub') userId: string, @Body() dto: LogoutDto) {
    return this.authLogoutService.logout(userId, dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authLogoutService.refresh(dto);
  }
}
