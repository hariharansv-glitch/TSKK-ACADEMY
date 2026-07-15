import { Injectable, Logger } from '@nestjs/common';
import { AttendanceStatus, FeeStatus, PaymentStatus, Prisma, StudentStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { formatINR } from '@common/utils/money.util';

interface DateRange {
  from: Date;
  to: Date;
}

function normalizeRange(input: Partial<DateRange>): DateRange {
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getFullYear(), to.getMonth() - 5, 1);
  return { from, to };
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Executive dashboard for an academy ───────────────────────────────────
  async dashboard(academyId: string): Promise<Record<string, unknown>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      activeStudents,
      totalStudents,
      activeInstructors,
      todayAttendance,
      pendingInvoices,
      monthRevenue,
      overdueCount,
      upcomingExams,
      recentBeltPromotions,
    ] = await Promise.all([
      this.prisma.student.count({ where: { academyId, status: StudentStatus.ACTIVE, deletedAt: null } }),
      this.prisma.student.count({ where: { academyId, deletedAt: null } }),
      this.prisma.instructor.count({ where: { academyId, isActive: true, deletedAt: null } }),
      this.prisma.attendance.count({
        where: { academyId, date: { gte: startOfDay }, status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] } },
      }),
      this.prisma.feeInvoice.aggregate({
        where: { academyId, status: { in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE] } },
        _sum: { balancePaise: true },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: { academyId, status: PaymentStatus.CAPTURED, paidAt: { gte: startOfMonth } },
        _sum: { amountPaise: true },
        _count: { _all: true },
      }),
      this.prisma.feeInvoice.count({
        where: { academyId, status: { in: [FeeStatus.PENDING, FeeStatus.PARTIAL] }, dueDate: { lt: now } },
      }),
      this.prisma.beltExam.count({
        where: { academyId, result: 'PENDING', examDate: { gte: now, lte: new Date(now.getTime() + 30 * 86400_000) } },
      }),
      this.prisma.beltExam.count({
        where: { academyId, result: 'PASSED', createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      students: { total: totalStudents, active: activeStudents },
      instructors: { active: activeInstructors },
      attendance: { today: todayAttendance },
      finance: {
        monthRevenuePaise: monthRevenue._sum.amountPaise ?? 0,
        monthRevenueFormatted: formatINR(monthRevenue._sum.amountPaise ?? 0),
        monthPaymentCount: monthRevenue._count._all ?? 0,
        pendingInvoicesCount: pendingInvoices._count._all ?? 0,
        pendingBalancePaise: pendingInvoices._sum.balancePaise ?? 0,
        pendingBalanceFormatted: formatINR(pendingInvoices._sum.balancePaise ?? 0),
        overdueInvoicesCount: overdueCount,
      },
      belts: { upcomingExams, recentPromotions: recentBeltPromotions },
      generatedAt: now,
    };
  }

  // ── Revenue over time ────────────────────────────────────────────────────
  async revenue(academyId: string, range: Partial<DateRange>): Promise<Record<string, unknown>> {
    const { from, to } = normalizeRange(range);
    const rows = await this.prisma.$queryRaw<Array<{ month: Date; total: bigint; count: bigint }>>`
      SELECT date_trunc('month', p."paidAt") as month,
             COALESCE(SUM(p."amountPaise"), 0)::bigint as total,
             COUNT(*)::bigint as count
      FROM payments p
      WHERE p."academyId" = ${academyId}
        AND p."status" = 'CAPTURED'
        AND p."paidAt" BETWEEN ${from} AND ${to}
      GROUP BY month
      ORDER BY month ASC
    `;
    return {
      from,
      to,
      series: rows.map((r) => ({
        month: r.month,
        totalPaise: Number(r.total),
        totalFormatted: formatINR(Number(r.total)),
        paymentCount: Number(r.count),
      })),
    };
  }

  // ── Attendance overview ──────────────────────────────────────────────────
  async attendanceOverview(academyId: string, range: Partial<DateRange>) {
    const { from, to } = normalizeRange(range);
    const grouped = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { academyId, date: { gte: from, lte: to } },
      _count: { _all: true },
    });
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    return {
      from,
      to,
      total,
      byStatus: grouped.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = r._count._all;
        return acc;
      }, {}),
    };
  }

  // ── Dropout report ───────────────────────────────────────────────────────
  async dropouts(academyId: string, range: Partial<DateRange>) {
    const { from, to } = normalizeRange(range);
    const rows = await this.prisma.student.findMany({
      where: {
        academyId,
        status: { in: [StudentStatus.LEFT, StudentStatus.SUSPENDED] },
        updatedAt: { gte: from, lte: to },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        studentCode: true,
        firstName: true,
        lastName: true,
        status: true,
        currentBelt: true,
        updatedAt: true,
        admissionDate: true,
      },
    });
    return { from, to, count: rows.length, students: rows };
  }

  // ── Belt progression ─────────────────────────────────────────────────────
  async beltProgression(academyId: string): Promise<Record<string, unknown>> {
    const beltDistribution = await this.prisma.student.groupBy({
      by: ['currentBelt'],
      where: { academyId, status: StudentStatus.ACTIVE, deletedAt: null },
      _count: { _all: true },
    });
    const passRates = await this.prisma.beltExam.groupBy({
      by: ['toBelt', 'result'],
      where: { academyId, result: { in: ['PASSED', 'FAILED'] } },
      _count: { _all: true },
    });
    const map = new Map<string, { passed: number; failed: number }>();
    for (const row of passRates) {
      const key = row.toBelt;
      const entry = map.get(key) ?? { passed: 0, failed: 0 };
      if (row.result === 'PASSED') entry.passed = row._count._all;
      if (row.result === 'FAILED') entry.failed = row._count._all;
      map.set(key, entry);
    }
    return {
      distribution: beltDistribution.map((b) => ({ belt: b.currentBelt, count: b._count._all })),
      passRates: Array.from(map.entries()).map(([belt, r]) => ({
        belt,
        passed: r.passed,
        failed: r.failed,
        passRatePercent:
          r.passed + r.failed === 0
            ? 0
            : Math.round((r.passed / (r.passed + r.failed)) * 1000) / 10,
      })),
    };
  }

  // ── Platform-wide analytics (super admin) ────────────────────────────────
  async platformOverview() {
    const [academies, activeAcademies, students, instructors, revenueTotal, subscriptionsByPlan] = await Promise.all([
      this.prisma.academy.count({ where: { deletedAt: null } }),
      this.prisma.academy.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.instructor.count({ where: { deletedAt: null } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.CAPTURED },
        _sum: { amountPaise: true },
      }),
      this.prisma.subscription.groupBy({ by: ['plan', 'status'], _count: { _all: true } }),
    ]);
    return {
      academies: { total: academies, active: activeAcademies },
      students: { total: students },
      instructors: { total: instructors },
      revenue: {
        totalPaise: revenueTotal._sum.amountPaise ?? 0,
        totalFormatted: formatINR(revenueTotal._sum.amountPaise ?? 0),
      },
      subscriptions: subscriptionsByPlan,
    };
  }
}
