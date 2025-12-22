import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { DateTime } from 'luxon';
import { GraphFilter, GraphFilterDto } from '../dto/graph-filter.dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminGraphStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error generating transport activity graph')
  async getTransportGraph(filterDto: GraphFilterDto) {
    const { filter = GraphFilter.LAST_7_DAYS } = filterDto;

    // ---------------------------
    // Compute Date Range
    // ---------------------------
    let from: DateTime;
    const to = DateTime.now().endOf('day');

    switch (filter) {
      case GraphFilter.LAST_7_DAYS:
        from = DateTime.now().minus({ days: 6 }).startOf('day');
        break;

      case GraphFilter.LAST_15_DAYS:
        from = DateTime.now().minus({ days: 14 }).startOf('day');
        break;

      case GraphFilter.LAST_30_DAYS:
        from = DateTime.now().minus({ days: 29 }).startOf('day');
        break;

      case GraphFilter.THIS_WEEK:
        from = DateTime.now().startOf('week');
        break;

      case GraphFilter.THIS_MONTH:
        from = DateTime.now().startOf('month');
        break;

      default:
        from = DateTime.now().minus({ days: 6 }).startOf('day');
    }

    // ---------------------------
    // Fetch transports
    // ---------------------------
    const transports = await this.prisma.client.transport.findMany({
      where: {
        createdAt: {
          gte: from.toJSDate(),
          lte: to.toJSDate(),
        },
      },
      select: { createdAt: true },
    });

    // ---------------------------
    // Prepare day-based counters
    // ---------------------------
    const days: Record<string, number> = {};
    const graph: any[] = [];

    // Initialize days
    for (let dt = from; dt <= to; dt = dt.plus({ days: 1 })) {
      const weekday = dt.toFormat('cccc'); // Monday
      const isoDate = dt.toISODate();
      if (isoDate !== null) {
        days[isoDate] = 0;
      }

      graph.push({
        dayName: weekday,
        date: dt.toFormat('dd LLL'), // 21 May
        total: 0,
      });
    }

    // Count transports
    transports.forEach((t) => {
      const dt = DateTime.fromJSDate(t.createdAt).toISODate();
      if (dt !== null && days[dt] !== undefined) days[dt]++;
    });

    // Fill totals
    graph.forEach((g) => {
      const dt = DateTime.fromFormat(g.date, 'dd LLL').set({
        year: DateTime.now().year,
      });
      const iso = dt.toISODate();
      g.total = iso !== null ? (days[iso] ?? 0) : 0;
    });

    return successResponse(
      {
        range: {
          from: from.toISODate(),
          to: to.toISODate(),
        },
        graph,
      },
      'Transport activity graph fetched successfully',
    );
  }
}
