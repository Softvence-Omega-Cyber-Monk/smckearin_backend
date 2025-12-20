import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VetAppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}
}
