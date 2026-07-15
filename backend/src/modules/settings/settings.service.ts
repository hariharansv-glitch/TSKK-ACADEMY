import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';
import type { UpdateSettingsInput } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(academyId: string) {
    const settings = await this.prisma.academySetting.findUnique({ where: { academyId } });
    if (!settings) {
      return this.prisma.academySetting.create({
        data: { academyId, workingHoursJson: this.defaultWorkingHours() },
      });
    }
    return settings;
  }

  async update(academyId: string, input: UpdateSettingsInput, req: AuthenticatedRequest) {
    const before = await this.get(academyId);
    const after = await this.prisma.academySetting.update({
      where: { academyId },
      data: {
        ...input,
        workingHoursJson: input.workingHoursJson as Prisma.InputJsonValue | undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'AcademySetting', academyId, { before, after });
    return after;
  }

  private defaultWorkingHours() {
    return {
      MON: { open: '06:00', close: '21:00' },
      TUE: { open: '06:00', close: '21:00' },
      WED: { open: '06:00', close: '21:00' },
      THU: { open: '06:00', close: '21:00' },
      FRI: { open: '06:00', close: '21:00' },
      SAT: { open: '06:00', close: '21:00' },
      SUN: { open: '08:00', close: '13:00' },
    };
  }
}
