import { UserEnum } from '@/common/enum/user.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class InviteAdminDto {
  @ApiProperty({ example: 'John Doe', description: 'Name of the admin' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'admin@example.com',
    description: 'Email of the admin',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: [UserEnum.ADMIN, UserEnum.SUPER_ADMIN],
    description: 'Role of the admin',
    default: UserEnum.ADMIN,
  })
  @IsEnum(UserEnum)
  role: UserEnum.ADMIN | UserEnum.SUPER_ADMIN;
}
