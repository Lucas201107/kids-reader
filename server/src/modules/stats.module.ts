import { Module, Controller, Get, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import dayjs from 'dayjs';

@Controller('stats')
@UseGuards(AuthGuard)
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  /** 学生个人统计：练习次数、平均分、近 7 天趋势、错词 Top */
  @Get('me')
  async me(@CurrentUser() user: any) {
    const records = await this.prisma.readingRecord.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
    });
    const total = records.length;
    const avg = total ? records.reduce((s, r) => s + r.score, 0) / total : 0;

    const days: { date: string; count: number; avgScore: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day');
      const rs = records.filter((r) => dayjs(r.createdAt).isSame(d, 'day'));
      days.push({
        date: d.format('MM-DD'),
        count: rs.length,
        avgScore: rs.length ? Math.round(rs.reduce((s, r) => s + r.score, 0) / rs.length) : 0,
      });
    }

    const wrongWords = await this.prisma.wrongWord.findMany({
      where: { userId: user.sub },
      orderBy: { count: 'desc' },
      take: 10,
    });

    return {
      total,
      avgScore: Math.round(avg),
      practiceDays: days,
      wrongWords,
      recent: records.slice(0, 10),
    };
  }

  /** 老师：班级统计（完成率、平均分排行、高频错词） */
  @Get('class/:id')
  async classStats(@CurrentUser() user: any, @Param('id') id: string, @Query('days') days?: string) {
    const classId = Number(id);
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) return { ok: false, message: '班级不存在' };
    if (cls.teacherId !== user.sub) throw new ForbiddenException('只能查看自己班级的数据');

    const since = dayjs().subtract(Number(days) || 30, 'day').toDate();
    const members = await this.prisma.user.findMany({
      where: { classId },
      select: { id: true, nickname: true, avatar: true },
    });
    const ids = members.map((m) => m.id);
    const records = await this.prisma.readingRecord.findMany({
      where: { userId: { in: ids }, createdAt: { gte: since } },
      select: { userId: true, score: true, wrongWords: true, refType: true, createdAt: true },
    });

    const ranking = members
      .map((m) => {
        const rs = records.filter((r) => r.userId === m.id);
        return {
          ...m,
          count: rs.length,
          avgScore: rs.length ? Math.round(rs.reduce((s, r) => s + r.score, 0) / rs.length) : 0,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count);

    // 高频错词
    const counter = new Map<string, number>();
    records.forEach((r) => {
      try {
        const ws: string[] = JSON.parse(r.wrongWords || '[]');
        ws.forEach((w) => counter.set(w, (counter.get(w) || 0) + 1));
      } catch {}
    });
    const topWrongWords = Array.from(counter.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const activeCount = members.filter((m) => records.some((r) => r.userId === m.id)).length;

    return {
      ok: true,
      class: cls,
      memberCount: members.length,
      activeCount,
      totalRecords: records.length,
      avgScore: records.length
        ? Math.round(records.reduce((s, r) => s + r.score, 0) / records.length)
        : 0,
      ranking,
      topWrongWords,
    };
  }
}

@Module({ controllers: [StatsController] })
export class StatsModule {}
