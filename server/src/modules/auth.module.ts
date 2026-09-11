import { Module, Controller, Post, Get, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser, Roles } from '../common/auth.guard';
import { code2Session } from '../vendor/wechat';
import { randomBytes } from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** 微信登录：code 换 openid，首次登录自动建号 */
  @Post('login')
  async login(
    @Body()
    body: {
      code: string;
      nickname?: string;
      avatar?: string;
      role?: string;
      grade?: number;
    },
  ) {
    const session = await code2Session(body.code);
    let user = await this.prisma.user.findUnique({ where: { openid: session.openid } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openid: session.openid,
          nickname: body.nickname || `同学${randomBytes(2).toString('hex')}`,
          avatar: body.avatar || '',
          role: body.role === 'teacher' ? 'teacher' : 'student',
          grade: body.grade || null,
        },
      });
    } else if (body.nickname || body.avatar) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { nickname: body.nickname || user.nickname, avatar: body.avatar || user.avatar },
      });
    }

    return this.pack(user);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: any) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { class: true },
    });
    return this.pack(full);
  }

  /** 完善资料 / 切换身份（学生选年级、老师注册）。用 POST 以兼容小程序 request */
  @Post('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: { nickname?: string; avatar?: string; role?: string; grade?: number },
  ) {
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        nickname: body.nickname,
        avatar: body.avatar,
        role: body.role,
        grade: body.grade,
      },
    });
    return this.pack(updated);
  }

  /** Web 管理后台登录：账号密码来自 .env（ADMIN_USER / ADMIN_PASS，默认 admin / admin123） */
  @Post('admin-login')
  async adminLogin(@Body() body: { username?: string; password?: string }) {
    const u = process.env.ADMIN_USER || 'admin';
    const p = process.env.ADMIN_PASS || 'admin123';
    if (body.username !== u || body.password !== p) {
      throw new UnauthorizedException('账号或密码不正确');
    }
    let admin = await this.prisma.user.findUnique({ where: { openid: '__admin__' } });
    if (!admin) {
      admin = await this.prisma.user.create({
        data: { openid: '__admin__', nickname: '管理员', role: 'teacher' },
      });
    }
    return this.pack(admin);
  }

  /** 老师身份校验入口：把当前账号升级为老师 */
  @Post('become-teacher')
  @UseGuards(AuthGuard)
  async becomeTeacher(@CurrentUser() user: any, @Body() body: { secret?: string }) {
    // 简单保护：与环境变量中的口令一致，避免学生随意改身份
    const key = process.env.TEACHER_INVITE_CODE || 'teacher2026';
    if (body.secret !== key) return { ok: false, message: '邀请码不正确' };
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: { role: 'teacher' },
    });
    return { ok: true, user: this.pack(updated) };
  }

  private pack(user: any) {
    const { id, openid, nickname, avatar, role, grade, classId, class: cls } = user;
    const token = this.jwt.sign({ sub: id, openid, role });
    return {
      token,
      user: {
        id,
        nickname,
        avatar,
        role,
        grade,
        classId,
        className: cls?.name || null,
        isTeacher: role === 'teacher',
      },
    };
  }
}

@Module({ controllers: [AuthController] })
export class AuthModule {}
