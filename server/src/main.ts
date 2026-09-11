import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  // 上传目录（音频 / 图片），通过 /static 访问
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/static' });

  // 老师 Web 管理后台（http://host/admin/index.html）
  // 开发态 __dirname=dist/src，生产态 dist/src 同理，向上两级回到 server 根
  const publicDir = path.join(__dirname, '..', '..', 'public');
  app.useStaticAssets(publicDir);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`\n  服务已启动: http://localhost:${port}`);
  console.log(`  管理后台: http://localhost:${port}/admin/index.html\n`);
}
bootstrap();
