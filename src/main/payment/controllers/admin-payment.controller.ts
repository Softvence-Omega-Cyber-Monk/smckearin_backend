import { ValidateAdmin } from '@/core/jwt/jwt.decorator';
import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Admin Payment')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('admin-payment')
export class AdminPaymentController {}
