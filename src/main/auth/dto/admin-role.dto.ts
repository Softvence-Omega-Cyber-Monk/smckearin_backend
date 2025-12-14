import { UserEnum } from '@/common/enum/user.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class AdminRoleDto {
  @ApiProperty({
    enum: [UserEnum.ADMIN, UserEnum.SUPER_ADMIN],
    description: 'New role for the user',
  })
  @IsNotEmpty()
  @IsEnum(UserEnum)
  role: UserEnum.ADMIN | UserEnum.SUPER_ADMIN;
}
