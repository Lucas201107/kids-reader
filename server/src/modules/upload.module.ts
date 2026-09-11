import { Module, Controller, Post, UploadedFile, UseInterceptors, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../common/auth.guard';
import { fileStorage, publicUrl } from '../common/upload.util';

@Controller('upload')
@UseGuards(AuthGuard)
export class UploadController {
  /** 通用文件上传（绘本配图 / 音频），返回可访问 URL */
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: fileStorage }))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('未选择文件');
    return { url: publicUrl('file', file.filename), filename: file.filename, size: file.size };
  }
}

@Module({ controllers: [UploadController] })
export class UploadModule {}
