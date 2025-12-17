import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateTransportDto } from '../dto/create-transport.dto';

@Injectable()
export class CreateTransportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Unable to create transport')
  async createTransport(userId: string, dto: CreateTransportDto) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const shelterId = user.shelterAdminOfId
      ? user.shelterAdminOfId
      : user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }
  }
}
