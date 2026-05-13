import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { ActivitiesRepository } from './activities.repository';

interface ReminderRow {
  activityId: string;
  applicationId: string;
  followUpAt: string;
  applicationSummary: {
    requestedAmountEGP: string;
    loanPurpose: string;
  };
}

@ApiTags('Admin · Reminders')
@ApiBearerAuth()
@Controller('admin/staff/me/reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RemindersController {
  constructor(
    private readonly repo: ActivitiesRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('super_admin', 'sales_manager', 'sales_agent')
  @ApiOperation({ summary: 'Pending follow-up reminders for the current staff member' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('windowHours', new DefaultValuePipe(24), ParseIntPipe) windowHours: number,
  ): Promise<{ success: true; data: { reminders: ReminderRow[] } }> {
    const window = Math.max(1, Math.min(168, windowHours));
    const activities = await this.repo.findRemindersForStaff(user.sub, window);

    const completedSourceIds = await this.prisma.activity.findMany({
      where: {
        activityType: 'INTERNAL_NOTE',
        reason: { in: ['FOLLOWUP_COMPLETED', 'FOLLOWUP_SNOOZED', 'FOLLOWUP_CANCELLED'] },
        actorStaffId: user.sub,
      },
      select: { meta: true },
    });
    const completed = new Set(
      completedSourceIds
        .map((c) => {
          const meta = (c.meta ?? {}) as { sourceActivityId?: string };
          return meta.sourceActivityId;
        })
        .filter((v): v is string => Boolean(v)),
    );

    const pending = activities.filter((a) => !completed.has(a.id));
    if (pending.length === 0) return { success: true, data: { reminders: [] } };

    const applicationIds = [...new Set(pending.map((a) => a.applicationId))];
    const apps = await this.prisma.application.findMany({
      where: { id: { in: applicationIds } },
      select: { id: true, requestedAmountEGP: true, loanPurpose: true },
    });
    const byId = new Map(apps.map((a) => [a.id, a]));

    const reminders: ReminderRow[] = pending
      .filter((a) => a.followUpAt !== null)
      .map((a) => {
        const app = byId.get(a.applicationId);
        return {
          activityId: a.id,
          applicationId: a.applicationId,
          followUpAt: a.followUpAt!.toISOString(),
          applicationSummary: {
            requestedAmountEGP: app?.requestedAmountEGP.toFixed(2) ?? '0.00',
            loanPurpose: app?.loanPurpose ?? 'unknown',
          },
        };
      });

    return { success: true, data: { reminders } };
  }
}
