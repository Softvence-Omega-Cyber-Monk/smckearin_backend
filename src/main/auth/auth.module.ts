import { Module } from '@nestjs/common';
import { AuthLoginController } from './controllers/auth-login.controller';
import { AuthNotificationController } from './controllers/auth-notification.controller';
import { AuthOtpController } from './controllers/auth-otp.controller';
import { AuthPasswordController } from './controllers/auth-password.controller';
import { AuthProfileController } from './controllers/auth-profile.controller';
import { AuthRegistrationController } from './controllers/auth-registration.controller';
import { AuthSettingsController } from './controllers/auth-settings.controller';
import { AuthGetProfileService } from './services/auth-get-profile.service';
import { AuthLoginService } from './services/auth-login.service';
import { AuthLogoutService } from './services/auth-logout.service';
import { AuthNotificationService } from './services/auth-notification.service';
import { AuthOtpService } from './services/auth-otp.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthRegisterService } from './services/auth-register.service';
import { AuthSettingService } from './services/auth-setting.service';
import { AuthUpdateProfileService } from './services/auth-update-profile.service';

@Module({
  imports: [],
  controllers: [
    AuthRegistrationController,
    AuthLoginController,
    AuthOtpController,
    AuthPasswordController,
    AuthProfileController,
    AuthNotificationController,
    AuthSettingsController,
  ],
  providers: [
    AuthLoginService,
    AuthLogoutService,
    AuthOtpService,
    AuthPasswordService,
    AuthGetProfileService,
    AuthUpdateProfileService,
    AuthRegisterService,
    AuthNotificationService,
    AuthSettingService,
  ],
})
export class AuthModule {}
