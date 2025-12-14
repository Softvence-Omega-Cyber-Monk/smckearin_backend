import { PaginationDto } from '@/common/dto/pagination.dto';
import { GetUser, ValidateAdmin, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DriverRegisterDto } from './dto/driver-register.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto, RefreshTokenDto } from './dto/logout.dto';
import { NotificationSettingsDto } from './dto/notification.dto';
import { ResendOtpDto, VerifyOTPDto } from './dto/otp.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateOperatingScheduleDto } from './dto/setting.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGetProfileService } from './services/auth-get-profile.service';
import { AuthLoginService } from './services/auth-login.service';
import { AuthLogoutService } from './services/auth-logout.service';
import { AuthNotificationService } from './services/auth-notification.service';
import { AuthOtpService } from './services/auth-otp.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthRegisterService } from './services/auth-register.service';
import { AuthSettingService } from './services/auth-setting.service';
import { AuthUpdateProfileService } from './services/auth-update-profile.service';

@ApiTags('Auth, Profile & Settings')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authLoginService: AuthLoginService,
    private readonly authLogoutService: AuthLogoutService,
    private readonly authOtpService: AuthOtpService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly authGetProfileService: AuthGetProfileService,
    private readonly authUpdateProfileService: AuthUpdateProfileService,
    private readonly authRegisterService: AuthRegisterService,
    private readonly authNotificationService: AuthNotificationService,
    private readonly authSettingService: AuthSettingService,
  ) {}

  @ApiOperation({ summary: 'Register as shelter or vet' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authRegisterService.register(body);
  }

  @ApiOperation({ summary: 'Register as driver' })
  @Post('driver/register')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(AnyFilesInterceptor())
  async driverRegister(
    @Body() body: DriverRegisterDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files || files.length < 3) {
      throw new BadRequestException(
        'driverLicense, vehicleRegistration, and transportCertificate are required',
      );
    }

    // Map files to DTO
    files.forEach((file) => {
      if (file.fieldname === 'driverLicense') body.driverLicense = file;
      if (file.fieldname === 'vehicleRegistration')
        body.vehicleRegistration = file;
      if (file.fieldname === 'transportCertificate')
        body.transportCertificate = file;
    });

    // Ensure all required files are actually uploaded
    if (
      !body.driverLicense ||
      !body.vehicleRegistration ||
      !body.transportCertificate
    ) {
      throw new BadRequestException(
        'driverLicense, vehicleRegistration, and transportCertificate are required',
      );
    }

    return this.authRegisterService.driverRegister(body);
  }

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

  @ApiOperation({ summary: 'Change Password' })
  @ApiBearerAuth()
  @Post('password/change')
  @ValidateAuth()
  async changePassword(
    @GetUser('sub') userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authPasswordService.changePassword(userId, body);
  }

  @ApiOperation({ summary: 'Forgot Password' })
  @Post('password/forgot')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authPasswordService.forgotPassword(body.email);
  }

  @ApiOperation({ summary: 'Reset Password' })
  @Post('password/reset')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authPasswordService.resetPassword(body);
  }

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

  @ApiOperation({ summary: 'Get Notification Setting' })
  @ApiBearerAuth()
  @Get('notification-setting')
  @ValidateAuth()
  async getNotificationSetting(@GetUser('sub') userId: string) {
    return this.authNotificationService.createOrGetNotificationSetting(userId);
  }

  @ApiOperation({ summary: 'Update Notification Setting' })
  @ApiBearerAuth()
  @Patch('notification-setting')
  @ValidateAuth()
  async updateVetShelterNotificationSetting(
    @GetUser('sub') userId: string,
    @Body() dto: NotificationSettingsDto,
  ) {
    return this.authNotificationService.updateNotificationSettings(userId, dto);
  }

  @ApiOperation({ summary: 'Get User Notifications' })
  @ApiBearerAuth()
  @Get('notifications')
  @ValidateAuth()
  async getUserNotifications(
    @GetUser('sub') userId: string,
    @Query() dto: PaginationDto,
  ) {
    return this.authNotificationService.getUserNotifications(userId, dto);
  }

  @ApiOperation({ summary: 'Mark All Notifications Read' })
  @ApiBearerAuth()
  @Patch('notifications')
  @ValidateAuth()
  asyncAllNotificationsRead(@GetUser('sub') userId: string) {
    return this.authNotificationService.markAllNotificationsRead(userId);
  }

  @ApiOperation({ summary: 'Mark Own Notification Read' })
  @ApiBearerAuth()
  @Patch('notifications/:notificationId')
  @ValidateAuth()
  async markNotificationRead(
    @Param('notificationId') notificationId: string,
    @GetUser('sub') userId: string,
  ) {
    return this.authNotificationService.markNotificationRead(
      notificationId,
      userId,
    );
  }

  @ApiOperation({ summary: 'Get Operating Schedule' })
  @ApiBearerAuth()
  @Get('operating-schedule')
  @ValidateAuth()
  async getOperatingSchedule(@GetUser() authUser: JWTPayload) {
    return this.authSettingService.getOperatingSchedule(authUser);
  }

  @ApiOperation({ summary: 'Update Operating Schedule' })
  @ApiBearerAuth()
  @Patch('operating-schedule')
  @ValidateAuth()
  async updateOperatingSchedule(
    @GetUser() authUser: JWTPayload,
    @Body() dto: UpdateOperatingScheduleDto,
  ) {
    return this.authSettingService.updateOperatingSchedule(authUser, dto);
  }
}
