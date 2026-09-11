import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export const ROLES_KEY = 'roles';
/** 用法：@Roles('teacher') */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** 用法：@CurrentUser() user */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

/**
 * 统一鉴权：校验 JWT，并在声明了 @Roles 时检查角色。
 * 小程序端请求头 Authorization: Bearer <token>
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (!token) throw new UnauthorizedException('未登录');

    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
    req.user = payload;

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && roles.length && !roles.includes(payload.role)) {
      throw new ForbiddenException('无权限访问');
    }
    return true;
  }
}
