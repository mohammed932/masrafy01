import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface ActivitySummaryRow {
  actorStaffId: string;
  activityType: string;
  count: number;
  totalDurationMinutes: number | null;
}

@Injectable()
export class LeadAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateActivityByAgent(windowDays: number): Promise<ActivitySummaryRow[]> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.activity.groupBy({
      by: ['actorStaffId', 'activityType'],
      where: { occurredAt: { gte: since } },
      _count: { _all: true },
      _sum: { durationMinutes: true },
      orderBy: [{ actorStaffId: 'asc' }, { activityType: 'asc' }],
    });
    return grouped.map((g) => ({
      actorStaffId: g.actorStaffId,
      activityType: g.activityType,
      count: g._count._all,
      totalDurationMinutes:
        g.activityType === 'CALLED_USER' ? g._sum.durationMinutes ?? null : null,
    }));
  }
}
