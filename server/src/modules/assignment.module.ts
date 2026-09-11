import {
  Module,
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser, Roles } from '../common/auth.guard';

@Controller('assignment')
@UseGuards(AuthGuard)
export class AssignmentController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles('teacher')
  async create(
    @CurrentUser() user: any,
    @Body() body: { classId: number; title: string; type: string; refIds: number[]; dueDate?: string },
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: Number(body.classId) } });
    if (!cls || cls.teacherId !== user.sub) throw new ForbiddenException('只能给自己班级布置任务');
    return this.prisma.assignment.create({
      data: {
        classId: Number(body.classId),
        teacherId: user.sub,
        title: body.title,
        type: body.type,
        refIds: JSON.stringify(body.refIds || []),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
  }

  /** 学生：本班任务；老师：我布置的任务 */
  @Get()
  async list(@CurrentUser() user: any, @Query('classId') classId?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: user.sub } });
    const cid = classId ? Number(classId) : me.classId;
    if (!cid) return [];
    const list = await this.prisma.assignment.findMany({
      where: { classId: cid },
      orderBy: { id: 'desc' },
    });
    // 学生端附带自己的完成状态
    if (me.role === 'student') {
      const done = await this.prisma.readingRecord.findMany({
        where: { userId: user.sub, assignmentId: { in: list.map((a) => a.id) } },
        select: { assignmentId: true, score: true },
      });
      const map: Record<number, number[]> = {};
      done.forEach((d) => {
        if (!d.assignmentId) return;
        (map[d.assignmentId] = map[d.assignmentId] || []).push(d.score);
      });
      return list.map((a) => ({
        ...a,
        refIds: safeJson(a.refIds),
        myScores: map[a.id] || [],
        finished: (map[a.id] || []).length > 0,
      }));
    }
    return list.map((a) => ({ ...a, refIds: safeJson(a.refIds) }));
  }

  @Get(':id')
  async detail(@CurrentUser() user: any, @Param('id') id: string) {
    const a = await this.prisma.assignment.findUnique({
      where: { id: Number(id) },
      include: { class: true },
    });
    if (!a) return { ok: false, message: '任务不存在' };
    const records = await this.prisma.readingRecord.findMany({
      where: { assignmentId: a.id },
      include: { user: { select: { id: true, nickname: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const members = await this.prisma.user.findMany({
      where: { classId: a.classId },
      select: { id: true, nickname: true, avatar: true },
    });
    const summary = members.map((m) => {
      const rs = records.filter((r) => r.userId === m.id);
      const avg = rs.length ? rs.reduce((s, r) => s + r.score, 0) / rs.length : 0;
      return { ...m, count: rs.length, avgScore: Math.round(avg), finished: rs.length > 0 };
    });
    return {
      ok: true,
      assignment: { ...a, refIds: safeJson(a.refIds) },
      summary,
      records: records.slice(0, 100),
    };
  }

  @Delete(':id')
  @Roles('teacher')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const a = await this.prisma.assignment.findUnique({ where: { id: Number(id) } });
    if (!a || a.teacherId !== user.sub) throw new ForbiddenException('无权限');
    await this.prisma.assignment.delete({ where: { id: Number(id) } });
    return { ok: true };
  }
}

function safeJson(s: string): number[] {
  try {
    return JSON.parse(s || '[]');
  } catch {
    return [];
  }
}

@Module({ controllers: [AssignmentController] })
export class AssignmentModule {}
