import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { GraphFilter, GraphFilterDto } from '../dto/graph-filter.dto';

@Injectable()
export class AdminGraphStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error generating transport activity graph')
  async getTransportGraph(filterDto: GraphFilterDto) {
    const { from, to } = this.getDateRange(
      filterDto.filter || GraphFilter.LAST_7_DAYS,
    );
    const transports = await this.prisma.client.transport.findMany({
      where: { createdAt: { gte: from.toJSDate(), lte: to.toJSDate() } },
      select: { createdAt: true },
    });

    const graph = this.initGraph(from, to);
    const days: Record<string, number> = {};
    graph.forEach((g) => {
      const iso = this.toISODate(g.date);
      if (iso) days[iso] = 0;
    });

    transports.forEach((t) => {
      const dt = DateTime.fromJSDate(t.createdAt).toISODate();
      if (dt && days[dt] !== undefined) days[dt]++;
    });

    return successResponse(
      this.mapGraphTotals(graph, days),
      'Transport activity graph fetched successfully',
    );
  }

  @HandleError('Error generating operational overview')
  async getOperationalOverview(filterDto: GraphFilterDto) {
    const { from, to } = this.getDateRange(filterDto.filter);
    const transports = await this.prisma.client.transport.findMany({
      where: { createdAt: { gte: from.toJSDate(), lte: to.toJSDate() } },
      select: { createdAt: true, status: true, animalId: true },
    });

    const graph = this.initGraph(from, to, [
      'activeTrips',
      'completedTransports',
      'totalAnimalsRescued',
    ]);
    const days: Record<
      string,
      {
        activeTrips: number;
        completedTransports: number;
        totalAnimalsRescued: number;
      }
    > = {};

    graph.forEach((g) => {
      const iso = this.toISODate(g.date);
      if (!iso) return;
      days[iso] = {
        activeTrips: 0,
        completedTransports: 0,
        totalAnimalsRescued: 0,
      };
    });

    transports.forEach((t) => {
      const dt = DateTime.fromJSDate(t.createdAt).toISODate();
      if (!dt || !days[dt]) return;

      days[dt].activeTrips += t.status !== 'COMPLETED' ? 1 : 0;
      days[dt].completedTransports += t.status === 'COMPLETED' ? 1 : 0;
      days[dt].totalAnimalsRescued += 1;
    });

    graph.forEach((g) => {
      const iso = this.toISODate(g.date);
      if (!iso || !days[iso]) return;
      Object.assign(g, days[iso]);
    });

    return successResponse(
      { range: { from: from.toISODate(), to: to.toISODate() }, graph },
      'Operational overview fetched successfully',
    );
  }

  private getDateRange(filter?: GraphFilter) {
    const to = DateTime.now().endOf('day');
    let from: DateTime;

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

    return { from, to };
  }

  private initGraph(from: DateTime, to: DateTime, extraFields: string[] = []) {
    const graph: any[] = [];
    for (let dt = from; dt <= to; dt = dt.plus({ days: 1 })) {
      const obj: any = {
        dayName: dt.toFormat('cccc'),
        date: dt.toFormat('dd LLL'),
      };
      extraFields.forEach((f) => (obj[f] = 0));
      graph.push(obj);
    }
    return graph;
  }

  private toISODate(dateStr: string) {
    return DateTime.fromFormat(dateStr, 'dd LLL')
      .set({ year: DateTime.now().year })
      .toISODate();
  }

  private mapGraphTotals(graph: any[], totals: Record<string, number>) {
    graph.forEach((g) => {
      const iso = this.toISODate(g.date);
      g.total = iso ? (totals[iso] ?? 0) : 0;
    });
    return {
      range: { from: graph[0]?.date, to: graph[graph.length - 1]?.date },
      graph,
    };
  }
}
