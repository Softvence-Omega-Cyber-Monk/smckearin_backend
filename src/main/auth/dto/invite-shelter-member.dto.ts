import { UserEnum } from '@/common/enum/user.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class InviteShelterMemberDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Name of the member' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'manager@example.com',
    description: 'Email of the member',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: [UserEnum.SHELTER_ADMIN, UserEnum.MANAGER],
    description: 'Role of the member',
    default: UserEnum.MANAGER,
  })
  @IsEnum(UserEnum)
  role: UserEnum.SHELTER_ADMIN | UserEnum.MANAGER;
}
