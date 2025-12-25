import { ValidateManager } from '@/core/jwt/jwt.decorator';
import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Shelter Payment')
@ApiBearerAuth()
@ValidateManager()
@Controller('shelter-payment')
export class ShelterPaymentController {}
