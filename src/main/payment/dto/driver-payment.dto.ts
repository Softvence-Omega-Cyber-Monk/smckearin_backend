import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class CreateOnboardingLinkDto {
  @ApiProperty({
    example: 'https://example.com/refresh',
    description: 'The URL to redirect to if onboarding is interrupted',
  })
  @IsUrl()
  @IsNotEmpty()
  refreshUrl: string;

  @ApiProperty({
    example: 'https://example.com/return',
    description: 'The URL to redirect to after onboarding is completed',
  })
  @IsUrl()
  @IsNotEmpty()
  returnUrl: string;
}
