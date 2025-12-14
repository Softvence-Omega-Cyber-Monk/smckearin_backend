import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DriverRegisterDto } from '../dto/driver-register.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthRegisterService } from '../services/auth-register.service';

@ApiTags('Auth, Profile & Settings')
@Controller('auth')
export class AuthRegistrationController {
  constructor(private readonly authRegisterService: AuthRegisterService) {}

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
}
