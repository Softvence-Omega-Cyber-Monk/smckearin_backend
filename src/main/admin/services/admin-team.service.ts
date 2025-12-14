import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InviteAdminDto } from '../dto/invite-admin.dto';

@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly mailService: AuthMailService,
  ) {}

  async inviteAdmin(dto: InviteAdminDto) {
    // 1. Check if email already exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new AppError(HttpStatus.CONFLICT, 'Email already in use');
    }

    // 2. Generate random password
    const generatedPassword = randomBytes(8).toString('hex');
    const hashedPassword = await this.authUtils.hash(generatedPassword);

    // 3. Create user
    const newUser = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: dto.role,
        isVerified: true, // Auto-verify admin emails or keep as false if email verification is strict
        status: 'ACTIVE',
      },
    });

    // 4. Send invitation email
    await this.mailService.sendAdminInvitationEmail(
      dto.email,
      dto.name,
      generatedPassword,
    );

    // 5. Return success
    const sanitizedUser = await this.authUtils.sanitizeUser(newUser);
    return successResponse(
      sanitizedUser,
      `Admin invitation sent successfully to ${dto.email}`,
    );
  }
}
