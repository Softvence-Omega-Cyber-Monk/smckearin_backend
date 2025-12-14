import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResendOtpDto, VerifyOTPDto } from '../dto/otp.dto';
import { AuthOtpService } from '../services/auth-otp.service';

@ApiTags('Auth, Profile & Settings')
@Controller('auth')
export class AuthOtpController {
  constructor(private readonly authOtpService: AuthOtpService) {}

  @ApiOperation({ summary: 'Verify OTP after Registration or Login' })
  @Post('verify-otp')
  async verifyEmail(@Body() body: VerifyOTPDto) {
    return this.authOtpService.verifyOTP(body);
  }

  @ApiOperation({ summary: 'Resend OTP to Email' })
  @Post('resend-otp')
  async resendOtp(@Body() body: ResendOtpDto) {
    return this.authOtpService.resendOtp(body);
  }
}
