import { Module, Controller, Post, Get, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser, Roles } from '../common/auth.guard';

function randomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

@Controller('class')
export class ClassController {
  constructor(private readonly prisma: PrismaService) {}

  /** 老师创建班级 */
  @Post()
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async create(@CurrentUser() user: any, @Body() body: { name: string; grade?: number }) {
    let code = randomCode();
    while (await this.prisma.class.findUnique({ where: { code } })) code = randomCode();
    return this.prisma.class.create({
      data: { name: body.name, grade: body.grade, teacherId: user.sub, code },
    });
  }

  /** 学生用班级码加入 */
  @Post('join')
  @UseGuards(AuthGuard)
  async join(@CurrentUser() user: any, @Body() body: { code: string }) {
    const cls = await this.prisma.class.findUnique({
      where: { code: (body.code || '').toUpperCase().trim() },
    });
    if (!cls) return { ok: false, message: '班级码不存在' };
    await this.prisma.user.update({ where: { id: user.sub }, data: { classId: cls.id } });
    return { ok: true, class: cls };
  }

  /** 我的班级（老师返回创建的全部班级，学生返回已加入的） */
  @Get('mine')
  @UseGuards(AuthGuard)
  async mine(@CurrentUser() user: any) {
    const me = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (me.role === 'teacher') {
      const list = await this.prisma.class.findMany({
        where: { teacherId: user.sub },
        include: { _count: { select: { students: true } } },
        orderBy: { id: 'desc' },
      });
      return list.map((c) => ({ ...c, studentCount: c._count.students }));
    }
    if (!me.classId) return [];
    const cls = await this.prisma.class.findUnique({
      where: { id: me.classId },
      include: { teacher: { select: { id: true, nickname: true } } },
    });
    return cls ? [cls] : [];
  }

  @Get(':id/members')
  @UseGuards(AuthGuard)
  async members(@CurrentUser() user: any, @Param('id') id: string) {
    const classId = Number(id);
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) return { ok: false, message: '班级不存在' };
    const me = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (cls.teacherId !== user.sub && me.classId !== classId) {
      return { ok: false, message: '无权限查看该班级' };
    }
    const members = await this.prisma.user.findMany({
      where: { classId },
      select: { id: true, nickname: true, avatar: true, grade: true, createdAt: true },
      orderBy: { id: 'asc' },
    });
    return { ok: true, class: cls, members };
  }

  @Delete(':id/members/:userId')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async remove(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') uid: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: Number(id) } });
    if (!cls || cls.teacherId !== user.sub) return { ok: false, message: '无权限' };
    await this.prisma.user.update({ where: { id: Number(uid) }, data: { classId: null } });
    return { ok: true };
  }

  /** 退出班级 */
  @Post('leave')
  @UseGuards(AuthGuard)
  async leave(@CurrentUser() user: any) {
    await this.prisma.user.update({ where: { id: user.sub }, data: { classId: null } });
    return { ok: true };
  }
}

@Module({ controllers: [ClassController] })
export class ClassModule {}
