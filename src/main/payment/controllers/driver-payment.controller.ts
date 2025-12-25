import { ValidateDriver } from '@/core/jwt/jwt.decorator';
import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Driver Payment')
@ApiBearerAuth()
@ValidateDriver()
@Controller('driver-payment')
export class DriverPaymentController {}
