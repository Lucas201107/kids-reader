import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthModule } from './modules/auth.module';
import { ClassModule } from './modules/class.module';
import { ContentModule } from './modules/content.module';
import { ReadingModule } from './modules/reading.module';
import { AssignmentModule } from './modules/assignment.module';
import { StatsModule } from './modules/stats.module';
import { UploadModule } from './modules/upload.module';

/** 全局数据库模块，任何模块都可直接注入 PrismaService */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'kids-reader-dev-secret',
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') || '30d' },
      }),
    }),
    PrismaModule,
    AuthModule,
    ClassModule,
    ContentModule,
    ReadingModule,
    AssignmentModule,
    StatsModule,
    UploadModule,
  ],
})
export class AppModule {}
