import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async create(academyId: string, input: CreateBranchInput, req: AuthenticatedRequest) {
    try {
      const branch = await this.prisma.$transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.branch.updateMany({
            where: { academyId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.branch.create({
          data: {
            academyId,
            name: input.name,
            code: input.code,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            state: input.state,
            country: input.country,
            postalCode: input.postalCode,
            phone: input.phone,
            email: input.email,
            managerId: input.managerId,
            isPrimary: input.isPrimary,
            isActive: input.isActive,
          },
        });
      });
      await this.audit.fromRequest(req, 'CREATE', 'Branch', branch.id, { after: branch });
      return branch;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A branch with this code already exists for this academy');
      }
      throw err;
    }
  }

  async list(academyId: string, query: ListBranchesQuery) {
    const where: Prisma.BranchWhereInput = {
      academyId,
      deletedAt: null,
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.BranchOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: query.sortDir } as Prisma.BranchOrderByWithRelationInput)
      : { isPrimary: 'desc' };

    const [total, rows] = await Promise.all([
      this.prisma.branch.count({ where }),
      this.prisma.branch.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findById(academyId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, academyId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(academyId: string, id: string, input: UpdateBranchInput, req: AuthenticatedRequest) {
    const before = await this.findById(academyId, id);
    try {
      const after = await this.prisma.$transaction(async (tx) => {
        if (input.isPrimary === true) {
          await tx.branch.updateMany({
            where: { academyId, isPrimary: true, NOT: { id } },
            data: { isPrimary: false },
          });
        }
        if (input.isPrimary === false && before.isPrimary) {
          const otherPrimary = await tx.branch.count({
            where: { academyId, isPrimary: true, NOT: { id }, deletedAt: null },
          });
          if (otherPrimary === 0) {
            throw new BadRequestException('An academy must always have at least one primary branch');
          }
        }
        return tx.branch.update({ where: { id }, data: input as Prisma.BranchUpdateInput });
      });
      await this.audit.fromRequest(req, 'UPDATE', 'Branch', id, { before, after });
      return after;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A branch with this code already exists for this academy');
      }
      throw err;
    }
  }

  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.findById(academyId, id);
    if (before.isPrimary) {
      throw new BadRequestException('Cannot delete the primary branch — promote another branch first');
    }
    await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.fromRequest(req, 'DELETE', 'Branch', id, { before });
    return { deleted: true };
  }
}
