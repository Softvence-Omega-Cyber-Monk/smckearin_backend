import { UserEnum } from '@/common/enum/user.enum';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InviteShelterMemberDto } from '../dto/invite-shelter-member.dto';
import { ShelterRoleDto } from '../dto/shelter-role.dto';
import { UserNotificationService } from '@/lib/queue/services/user-notification.service';

@Injectable()
export class AuthShelterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly mailService: AuthMailService,
    private readonly notificationService: UserNotificationService,
  ) {}

  private async getShelter(
    userId: string,
  ): Promise<{ id: string; name: string }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        shelterAdminOf: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user || !user.shelterAdminOf) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not associated with any shelter as Admin',
      );
    }

    return user.shelterAdminOf;
  }

  @HandleError('Failed to fetch shelter team')
  async getTeam(userId: string) {
    const shelter = await this.getShelter(userId);

    const team = await this.prisma.client.user.findMany({
      where: {
        OR: [{ shelterAdminOfId: shelter.id }, { managerOfId: shelter.id }],
      },
    });

    return successResponse(team, 'Shelter team fetched successfully');
  }

  @HandleError('Failed to invite shelter member')
  async inviteMember(userId: string, dto: InviteShelterMemberDto) {
    const shelter = await this.getShelter(userId);

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
        // Associate with the shelter based on role
        ...(dto.role === UserEnum.SHELTER_ADMIN
          ? { shelterAdminOfId: shelter.id }
          : { managerOfId: shelter.id }),
      },
    });

    await this.mailService.sendShelterInvitationEmail(
      dto.email,
      dto.name,
      shelter.name,
      generatedPassword,
    );

    // TODO: NOTIFICATION - Shelter Team Member Invited
    // What: Send notification to shelter admins about new team member invitation
    // Recipients: All SHELTER_ADMIN users in the same shelter (excluding the inviter)
    // Settings: emailNotifications
    // Meta: { shelterId: shelter.id, shelterName: shelter.name, invitedEmail: dto.email, invitedName: dto.name, role: dto.role }
    // Note: The invited user already receives an email via sendShelterInvitationEmail
    await this.notificationService.notifyTeamManagement(
      'INVITED',
      shelter.id,
      { id: newUser.id, name: newUser.name, email: newUser.email },
      dto.role,
    );

    const sanitizedUser = await this.authUtils.sanitizeUser(newUser);
    return successResponse(
      sanitizedUser,
      `Invitation sent successfully to ${dto.email}`,
    );
  }

  @HandleError("Failed to update member's role")
  async changeRole(userId: string, memberId: string, dto: ShelterRoleDto) {
    const shelter = await this.getShelter(userId);
    const shelterId = shelter.id;

    const member = await this.prisma.client.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Member not found');
    }

    // Verify member belongs to same shelter
    if (
      member.shelterAdminOfId !== shelterId &&
      member.managerOfId !== shelterId
    ) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Member does not belong to your shelter',
      );
    }

    // Safeguard: Cannot demote the last SHELTER_ADMIN
    if (
      member.role === UserEnum.SHELTER_ADMIN &&
      dto.role !== UserEnum.SHELTER_ADMIN
    ) {
      const adminCount = await this.prisma.client.user.count({
        where: {
          shelterAdminOfId: shelterId,
        },
      });

      if (adminCount <= 1) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          'Cannot demote the last Shelter Admin',
        );
      }
    }

    // Update role and relationships
    const updateData: any = { role: dto.role };

    if (dto.role === UserEnum.SHELTER_ADMIN) {
      updateData.shelterAdminOfId = shelterId;
      updateData.managerOfId = null;
    } else {
      updateData.managerOfId = shelterId;
      updateData.shelterAdminOfId = null;
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: memberId },
      data: updateData,
    });

    // TODO: NOTIFICATION - Shelter Member Role Changed
    // What: Send notification about role change
    // Recipients:
    //   1. The member whose role was changed (memberId)
    //   2. All SHELTER_ADMIN users in the same shelter (excluding the one making the change)
    // Settings: emailNotifications
    // Meta: { shelterId, shelterName: shelter.name, memberName: updatedUser.name, memberEmail: updatedUser.email, oldRole: member.role, newRole: dto.role }
    await this.notificationService.notifyTeamManagement(
      'ROLE_CHANGED',
      shelterId,
      { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email },
      dto.role,
      member.role,
    );

    const sanitizedUser = await this.authUtils.sanitizeUser(updatedUser);
    return successResponse(
      sanitizedUser,
      `Member role updated to ${dto.role} successfully`,
    );
  }

  @HandleError('Failed to remove shelter member')
  async removeMember(userId: string, memberId: string) {
    const shelter = await this.getShelter(userId);
    const shelterId = shelter.id;

    const member = await this.prisma.client.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Member not found');
    }

    // Verify member belongs to same shelter
    if (
      member.shelterAdminOfId !== shelterId &&
      member.managerOfId !== shelterId
    ) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Member does not belong to your shelter',
      );
    }

    // Safeguard: Cannot remove the last SHELTER_ADMIN
    if (member.role === UserEnum.SHELTER_ADMIN) {
      const adminCount = await this.prisma.client.user.count({
        where: {
          shelterAdminOfId: shelterId,
        },
      });

      if (adminCount <= 1) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          'Cannot remove the last Shelter Admin',
        );
      }
    }

    // TODO: NOTIFICATION - Shelter Member Removed
    // What: Send notification about member removal
    // Recipients:
    //   1. The member being removed (send before deletion)
    //   2. All remaining SHELTER_ADMIN users in the same shelter
    // Settings: emailNotifications
    // Meta: { shelterId, shelterName: shelter.name, removedMemberName: member.name, removedMemberEmail: member.email, removedMemberRole: member.role }
    // Note: Send notification to the removed member BEFORE deleting the user
    await this.notificationService.notifyTeamManagement('REMOVED', shelterId, {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
    });

    const removedUser = await this.prisma.client.user.delete({
      where: { id: memberId },
    });

    return successResponse(
      { id: removedUser.id },
      'Member removed successfully',
    );
  }
}
