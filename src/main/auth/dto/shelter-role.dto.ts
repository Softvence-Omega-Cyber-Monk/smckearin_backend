import { UserEnum } from '@/common/enum/user.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class ShelterRoleDto {
  @ApiProperty({
    enum: [UserEnum.SHELTER_ADMIN, UserEnum.MANAGER],
    description: 'New role for the member',
  })
  @IsNotEmpty()
  @IsEnum(UserEnum)
  role: UserEnum.SHELTER_ADMIN | UserEnum.MANAGER;
}
