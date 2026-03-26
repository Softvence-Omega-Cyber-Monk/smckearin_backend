import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { NotificationType } from '../enums/notification-types.enum';
import { QueueGateway } from '../queue.gateway';
import { BaseNotificationService } from './base-notification.service';

@Injectable()
export class UserNotificationService extends BaseNotificationService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly queueGateway: QueueGateway,
  ) {
    super(prisma, queueGateway);
  }

  // ==================== USER REGISTRATION ====================

  async notifyUserRegistration(
    type: 'SHELTER' | 'VET' | 'DRIVER' | 'FOSTER',
    entityId: string,
    user: { id: string; name: string; email: string },
  ) {
    const notifType =
      type === 'SHELTER'
        ? NotificationType.SHELTER_REGISTERED
        : type === 'VET'
          ? NotificationType.VET_REGISTERED
          : type === 'DRIVER'
            ? NotificationType.DRIVER_REGISTERED
            : NotificationType.FOSTER_REGISTERED;

    const title = `New ${type === 'SHELTER' ? 'Shelter' : type === 'VET' ? 'Veterinarian' : type === 'DRIVER' ? 'Driver' : 'Foster'} Registration`;
    const message = `${user.name} (${user.email}) has registered as a ${type === 'SHELTER' ? 'shelter admin' : type.toLowerCase()} and requires approval.`;

    const admins = await this.getAdmins();
    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      admins,
      {
        performedBy: 'SYSTEM',
        recordType:
          type === 'SHELTER'
            ? 'Shelter'
            : type === 'VET'
              ? 'Veterinarian'
              : type === 'DRIVER'
                ? 'Driver'
                : 'Foster',
        recordId: entityId,
        others: { userId: user.id, userName: user.name, userEmail: user.email },
      },
      ['emailNotifications'],
    );
  }

  // ==================== TEAM MANAGEMENT ====================

  async notifyTeamManagement(
    action: 'INVITED' | 'ROLE_CHANGED' | 'REMOVED',
    shelterId: string,
    member: { id: string; name: string; email: string; role?: string },
    newRole?: string,
    oldRole?: string,
  ) {
    const shelter = await this.prisma.client.shelter.findUnique({
      where: { id: shelterId },
      select: { id: true, name: true },
    });

    if (!shelter) return;

    let notifType: NotificationType;
    let title: string;
    let message: string;

    switch (action) {
      case 'INVITED':
        notifType = NotificationType.SHELTER_MEMBER_INVITED;
        title = 'New Team Member Invited';
        message = `${member.name} has been invited to join ${shelter.name} as ${newRole}.`;
        break;
      case 'ROLE_CHANGED':
        notifType = NotificationType.SHELTER_MEMBER_ROLE_CHANGED;
        title = 'Team Member Role Changed';
        message = `${member.name}'s role has been changed from ${oldRole} to ${newRole} in ${shelter.name}.`;
        break;
      case 'REMOVED':
        notifType = NotificationType.SHELTER_MEMBER_REMOVED;
        title = 'Team Member Removed';
        message = `${member.name} has been removed from ${shelter.name}.`;
        break;
    }

    // Notify shelter admins
    const shelterAdmins = await this.getShelterAdmins(shelterId);
    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      shelterAdmins,
      {
        performedBy: 'SYSTEM',
        recordType: 'User',
        recordId: member.id,
        others: {
          shelterId,
          shelterName: shelter.name,
          memberName: member.name,
          memberEmail: member.email,
          newRole,
          oldRole,
        },
      },
      ['emailNotifications'],
    );

    // Also notify the affected member
    if (action !== 'INVITED') {
      await this.createAndEmitNotification(
        notifType,
        title,
        action === 'ROLE_CHANGED'
          ? `Your role has been changed to ${newRole}`
          : `You have been removed from ${shelter.name}`,
        [member.id],
        {
          performedBy: 'SYSTEM',
          recordType: 'User',
          recordId: member.id,
          others: { shelterId, shelterName: shelter.name, newRole, oldRole },
        },
        ['emailNotifications'],
      );
    }
  }

  async notifyAdminManagement(
    action: 'INVITED' | 'ROLE_CHANGED' | 'DELETED',
    admin: { id: string; name: string; email: string; role?: string },
    newRole?: string,
    oldRole?: string,
  ) {
    let notifType: NotificationType;
    let title: string;
    let message: string;

    switch (action) {
      case 'INVITED':
        notifType = NotificationType.ADMIN_INVITED;
        title = 'New Admin Invited';
        message = `${admin.name} has been invited as ${newRole}.`;
        break;
      case 'ROLE_CHANGED':
        notifType = NotificationType.ADMIN_ROLE_CHANGED;
        title = 'Admin Role Changed';
        message = `${admin.name}'s role has been changed from ${oldRole} to ${newRole}.`;
        break;
      case 'DELETED':
        notifType = NotificationType.ADMIN_DELETED;
        title = 'Admin Deleted';
        message = `${admin.name} has been removed from the system.`;
        break;
    }

    // Notify all super admins
    const superAdmins = await this.getSuperAdmins();
    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      superAdmins,
      {
        performedBy: 'SYSTEM',
        recordType: 'User',
        recordId: admin.id,
        others: {
          adminName: admin.name,
          adminEmail: admin.email,
          newRole,
          oldRole,
        },
      },
      ['emailNotifications'],
    );

    // Also notify the affected admin
    if (action !== 'INVITED') {
      await this.createAndEmitNotification(
        notifType,
        title,
        action === 'ROLE_CHANGED'
          ? `Your role has been changed to ${newRole}`
          : 'Your admin account has been deleted',
        [admin.id],
        {
          performedBy: 'SYSTEM',
          recordType: 'User',
          recordId: admin.id,
          others: { newRole, oldRole },
        },
        ['emailNotifications'],
      );
    }
  }

  // ==================== APPROVAL STATUS ====================

  async notifyApprovalStatusChange(
    entityType: 'SHELTER' | 'DRIVER' | 'VET' | 'FOSTER',
    entityId: string,
    approved: boolean,
  ) {
    let entity: any;
    let userId: string;
    let notifType: NotificationType;
    let title: string;
    let message: string;

    if (entityType === 'SHELTER') {
      entity = await this.prisma.client.shelter.findUnique({
        where: { id: entityId },
        include: { shelterAdmins: true, managers: true },
      });

      notifType = approved
        ? NotificationType.SHELTER_APPROVED
        : NotificationType.SHELTER_REJECTED;
      title = `Shelter ${approved ? 'Approved' : 'Rejected'}`;
      message = `Your shelter "${entity.name}" has been ${approved ? 'approved' : 'rejected'}.`;

      const teamIds = [
        ...entity.shelterAdmins.map((a: any) => a.id),
        ...entity.managers.map((m: any) => m.id),
      ];

      await this.createAndEmitNotification(
        notifType,
        title,
        message,
        teamIds,
        {
          performedBy: 'ADMIN',
          recordType: 'Shelter',
          recordId: entityId,
          others: { shelterName: entity.name, approved },
        },
        ['emailNotifications'],
      );
      return;
    } else if (entityType === 'DRIVER') {
      entity = await this.prisma.client.driver.findUnique({
        where: { id: entityId },
        include: { user: true },
      });
      userId = entity.userId;
      notifType = approved
        ? NotificationType.DRIVER_APPROVED
        : NotificationType.DRIVER_REJECTED;
      title = `Driver Account ${approved ? 'Approved' : 'Rejected'}`;
      message = `Your driver account has been ${approved ? 'approved' : 'rejected'}.`;
    } else if (entityType === 'FOSTER') {
      entity = await this.prisma.client.foster.findUnique({
        where: { id: entityId },
        include: { user: true },
      });
      userId = entity.userId;
      notifType = approved
        ? NotificationType.FOSTER_APPROVED
        : NotificationType.FOSTER_REJECTED;
      title = `Foster Account ${approved ? 'Approved' : 'Rejected'}`;
      message = `Your foster account has been ${approved ? 'approved' : 'rejected'}.`;
    } else {
      entity = await this.prisma.client.veterinarian.findUnique({
        where: { id: entityId },
        include: { user: true },
      });
      userId = entity.userId;
      notifType = approved
        ? NotificationType.VET_APPROVED
        : NotificationType.VET_REJECTED;
      title = `Veterinarian Account ${approved ? 'Approved' : 'Rejected'}`;
      message = `Your veterinarian account has been ${approved ? 'approved' : 'rejected'}.`;
    }

    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      [userId],
      {
        performedBy: 'ADMIN',
        recordType:
          entityType === 'DRIVER'
            ? 'Driver'
            : entityType === 'FOSTER'
              ? 'Foster'
              : 'Veterinarian',
        recordId: entityId,
        others: { approved },
      },
      ['emailNotifications'],
    );
  }

  // ==================== ACCOUNT DELETION ====================

  async notifyAccountDeletion(
    type: 'SHELTER' | 'DRIVER' | 'VET' | 'FOSTER',
    userId: string,
    details: {
      name: string;
      email: string;
      shelterId?: string;
      teamMemberIds?: string[];
    },
  ) {
    const notifType =
      type === 'SHELTER'
        ? NotificationType.SHELTER_DELETED
        : type === 'DRIVER'
          ? NotificationType.DRIVER_DELETED
          : type === 'VET'
            ? NotificationType.VET_DELETED
            : NotificationType.FOSTER_DELETED;

    const title = `${type.charAt(0) + type.slice(1).toLowerCase()} Account Deleted`;
    const message =
      type === 'SHELTER'
        ? `The shelter "${details.name}" has been deleted from the system.`
        : `Your ${type.toLowerCase()} account has been deleted.`;

    const recipients =
      type === 'SHELTER' ? details.teamMemberIds || [] : [userId];

    if (recipients.length === 0) return;

    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      recipients,
      {
        performedBy: 'ADMIN',
        recordType:
          type === 'SHELTER'
            ? 'Shelter'
            : type === 'DRIVER'
              ? 'Driver'
              : type === 'VET'
                ? 'Veterinarian'
                : 'Foster',
        recordId: type === 'SHELTER' ? details.shelterId : userId,
        others: { name: details.name, email: details.email },
      },
      ['emailNotifications'],
    );
  }

  async notifyFosterRequestEvent(
    action:
      | 'CREATED'
      | 'APPROVED'
      | 'DECLINED'
      | 'SCHEDULED'
      | 'ARRIVED'
      | 'DELIVERED'
      | 'CANCELLED',
    fosterRequestId: string,
  ) {
    const fosterRequest = await this.prisma.client.fosterRequest.findUnique({
      where: { id: fosterRequestId },
      include: {
        animal: true,
        fosterUser: true,
        shelter: {
          include: {
            shelterAdmins: true,
            managers: true,
          },
        },
        transport: {
          include: {
            driver: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!fosterRequest) return;

    let notifType: NotificationType;
    let title: string;
    let message: string;
    let recipients: string[] = [];
    const settingKeys = ['tripNotifications', 'emailNotifications'];

    switch (action) {
      case 'CREATED':
        notifType = NotificationType.FOSTER_REQUEST_CREATED;
        title = 'Foster Request Created';
        message = `A foster request for ${fosterRequest.animal.name} has been created.`;
        recipients = [
          ...fosterRequest.shelter.shelterAdmins.map((user) => user.id),
          ...fosterRequest.shelter.managers.map((user) => user.id),
        ];
        break;
      case 'APPROVED':
        notifType = NotificationType.FOSTER_REQUEST_APPROVED;
        title = 'Foster Request Approved';
        message = `Your foster request for ${fosterRequest.animal.name} has been approved.`;
        if (fosterRequest.fosterUserId) {
          recipients = [fosterRequest.fosterUserId];
        }
        break;
      case 'DECLINED':
        notifType = NotificationType.FOSTER_REQUEST_DECLINED;
        title = 'Foster Request Declined';
        message = `Your foster request for ${fosterRequest.animal.name} has been declined.`;
        if (fosterRequest.fosterUserId) {
          recipients = [fosterRequest.fosterUserId];
        }
        break;
      case 'SCHEDULED':
        notifType = NotificationType.FOSTER_REQUEST_SCHEDULED;
        title = 'Foster Transport Scheduled';
        message = `Transport for ${fosterRequest.animal.name} has been scheduled.`;
        recipients = [
          ...(fosterRequest.fosterUserId ? [fosterRequest.fosterUserId] : []),
          ...(fosterRequest.transport?.driver?.userId
            ? [fosterRequest.transport.driver.userId]
            : []),
        ];
        break;
      case 'ARRIVED':
        notifType = NotificationType.FOSTER_REQUEST_ARRIVED;
        title = 'Foster Transport Arrived';
        message = `${fosterRequest.animal.name} has arrived for handoff.`;
        recipients = [
          ...fosterRequest.shelter.shelterAdmins.map((user) => user.id),
          ...fosterRequest.shelter.managers.map((user) => user.id),
        ];
        break;
      case 'DELIVERED':
        notifType = NotificationType.FOSTER_REQUEST_DELIVERED;
        title = 'Foster Delivery Confirmed';
        message = `${fosterRequest.animal.name} has been marked as delivered.`;
        recipients = [
          ...fosterRequest.shelter.shelterAdmins.map((user) => user.id),
          ...fosterRequest.shelter.managers.map((user) => user.id),
        ];
        break;
      case 'CANCELLED':
        notifType = NotificationType.FOSTER_REQUEST_CANCELLED;
        title = 'Foster Request Cancelled';
        message = `The foster request for ${fosterRequest.animal.name} has been cancelled.`;
        recipients = [
          ...(fosterRequest.fosterUserId ? [fosterRequest.fosterUserId] : []),
          ...(fosterRequest.transport?.driver?.userId
            ? [fosterRequest.transport.driver.userId]
            : []),
        ];
        break;
    }

    recipients = [...new Set(recipients.filter(Boolean))];
    if (!recipients.length) return;

    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      recipients,
      {
        performedBy: 'SYSTEM',
        recordType: 'FosterRequest',
        recordId: fosterRequest.id,
        others: {
          animalId: fosterRequest.animalId,
          animalName: fosterRequest.animal.name,
          shelterId: fosterRequest.shelterId,
          fosterUserId: fosterRequest.fosterUserId,
          transportId: fosterRequest.transportId,
          action,
        },
      },
      settingKeys,
    );
  }
}
