import { UserEnum } from '@/common/enum/user.enum';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AdminRoleDto } from '../dto/admin-role.dto';
import { InviteAdminDto } from '../dto/invite-admin.dto';

@Injectable()
export class AuthAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly mailService: AuthMailService,
  ) {}

  @HandleError('Failed to fetch admins')
  async getAdmins() {
    const admins = await this.prisma.client.user.findMany({
      where: { role: { in: [UserEnum.ADMIN, UserEnum.SUPER_ADMIN] } },
    });
    return successResponse(admins, 'Admins fetched successfully');
  }

  @HandleError('Failed to invite admin')
  async inviteAdmin(dto: InviteAdminDto) {
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new AppError(HttpStatus.CONFLICT, 'Email already in use');
    }

    const generatedPassword = randomBytes(8).toString('hex');
    const hashedPassword = await this.authUtils.hash(generatedPassword);

    const newUser = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: dto.role,
        isVerified: true,
        status: 'ACTIVE',
        notificationSettings: { create: {} },
      },
    });

    await this.mailService.sendAdminInvitationEmail(
      dto.email,
      dto.name,
      generatedPassword,
    );

    // TODO: NOTIFICATION - Admin Invited to System
    // What: Send notification to super admins about new admin invitation
    // Recipients: All SUPER_ADMIN users (excluding the one sending the invite)
    // Settings: emailNotifications
    // Meta: { invitedEmail: dto.email, invitedName: dto.name, role: dto.role }
    // Note: The invited admin already receives an email via sendAdminInvitationEmail

    const sanitizedUser = await this.authUtils.sanitizeUser(newUser);
    return successResponse(
      sanitizedUser,
      `Admin invitation sent successfully to ${dto.email}`,
    );
  }

  @HandleError("Failed to update admin's role")
  async changeRole(userId: string, dto: AdminRoleDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    // checking if they are the only super admin
    if (
      user.role === UserEnum.SUPER_ADMIN &&
      dto.role !== UserEnum.SUPER_ADMIN
    ) {
      const superAdminCount = await this.prisma.client.user.count({
        where: { role: UserEnum.SUPER_ADMIN },
      });

      if (superAdminCount <= 1) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          'Cannot demote the last Super Admin',
        );
      }
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: { role: dto.role },
    });

    // TODO: NOTIFICATION - Admin Role Changed
    // What: Send notification about admin role change
    // Recipients:
    //   1. The admin whose role was changed (userId)
    //   2. All SUPER_ADMIN users (excluding the one making the change)
    // Settings: emailNotifications
    // Meta: { adminName: updatedUser.name, adminEmail: updatedUser.email, oldRole: user.role, newRole: dto.role }

    const sanitizedUser = await this.authUtils.sanitizeUser(updatedUser);
    return successResponse(
      sanitizedUser,
      `User role updated to ${dto.role} successfully`,
    );
  }

  @HandleError('Failed to delete admin user')
  async deleteAdmin(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    if (user.role === UserEnum.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.client.user.count({
        where: { role: UserEnum.SUPER_ADMIN },
      });

      if (superAdminCount <= 1) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          'Cannot delete the last Super Admin',
        );
      }
    }

    // TODO: NOTIFICATION - Admin Deleted from System
    // What: Send notification about admin deletion
    // Recipients:
    //   1. The admin being deleted (send before deletion)
    //   2. All remaining SUPER_ADMIN users
    // Settings: emailNotifications
    // Meta: { deletedAdminName: user.name, deletedAdminEmail: user.email, deletedAdminRole: user.role }
    // Note: Send notification to the deleted admin BEFORE deleting the user

    const deletedUser = await this.prisma.client.user.delete({
      where: { id: userId },
    });

    return successResponse(
      { id: deletedUser.id },
      'Admin user deleted successfully',
    );
  }
}
