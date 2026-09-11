import {
  Module,
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser, Roles } from '../common/auth.guard';
import { imageStorage, publicUrl } from '../common/upload.util';
import { ocrImage } from '../vendor/ocr';

const pick = (row: any, keys: string[]) => {
  for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== '') return String(row[k]);
  return '';
};

@Controller('content')
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  /** 统一详情：type=word|lesson|bookPage，返回跟读所需的原文 */
  @Get('detail')
  @UseGuards(AuthGuard)
  async detail(@Query('type') type: string, @Query('id') id: string) {
    const nid = Number(id);
    if (type === 'word') {
      const w = await this.prisma.word.findUnique({ where: { id: nid } });
      return w ? { title: w.text, text: w.text, translation: w.meaning, audio: w.audio } : null;
    }
    if (type === 'lesson') {
      const l = await this.prisma.lesson.findUnique({ where: { id: nid } });
      return l ? { title: l.title, text: l.content, translation: l.translation, audio: l.audio } : null;
    }
    if (type === 'bookPage') {
      const p = await this.prisma.bookPage.findUnique({
        where: { id: nid },
        include: { book: true },
      });
      return p
        ? { title: p.book.title, text: p.text, translation: p.translation, audio: p.audio, image: p.image }
        : null;
    }
    return null;
  }

  // ---------- 绘本 ----------
  @Get('books')
  @UseGuards(AuthGuard)
  async books(@Query('grade') grade?: string, @Query('keyword') keyword?: string) {
    const g = Number(grade);
    return this.prisma.book.findMany({
      where: {
        ...(Number.isFinite(g) && g > 0 ? { grade: { lte: g }, OR: [{ gradeTo: null }, { gradeTo: { gte: g } }] } : {}),
        ...(keyword ? { title: { contains: keyword } } : {}),
      },
      include: { _count: { select: { pages: true } } },
      orderBy: { id: 'desc' },
    });
  }

  @Get('books/:id')
  @UseGuards(AuthGuard)
  async book(@Param('id') id: string) {
    return this.prisma.book.findUnique({
      where: { id: Number(id) },
      include: { pages: { orderBy: { pageNo: 'asc' } } },
    });
  }

  @Post('books')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async createBook(
    @CurrentUser() user: any,
    @Body()
    body: {
      id?: number;
      title: string;
      cover?: string;
      description?: string;
      grade: number;
      gradeTo?: number;
      pages?: { pageNo?: number; text: string; translation?: string; image?: string; audio?: string }[];
    },
  ) {
    if (body.id) {
      await this.prisma.bookPage.deleteMany({ where: { bookId: body.id } });
      await this.prisma.book.update({
        where: { id: body.id },
        data: {
          title: body.title,
          cover: body.cover,
          description: body.description,
          grade: body.grade,
          gradeTo: body.gradeTo,
        },
      });
      if (body.pages?.length) {
        await this.prisma.bookPage.createMany({
          data: body.pages.map((p, i) => ({
            bookId: body.id,
            pageNo: p.pageNo ?? i + 1,
            text: p.text,
            translation: p.translation || '',
            image: p.image || '',
            audio: p.audio || '',
          })),
        });
      }
      return this.book(String(body.id));
    }

    return this.prisma.book.create({
      data: {
        title: body.title,
        cover: body.cover || '',
        description: body.description || '',
        grade: body.grade,
        gradeTo: body.gradeTo || null,
        createdById: user.sub,
        pages: {
          create: (body.pages || []).map((p, i) => ({
            pageNo: p.pageNo ?? i + 1,
            text: p.text,
            translation: p.translation || '',
            image: p.image || '',
            audio: p.audio || '',
          })),
        },
      },
      include: { pages: true },
    });
  }

  @Delete('books/:id')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async deleteBook(@Param('id') id: string) {
    await this.prisma.bookPage.deleteMany({ where: { bookId: Number(id) } });
    await this.prisma.book.delete({ where: { id: Number(id) } });
    return { ok: true };
  }

  // ---------- 课文 ----------
  @Get('lessons')
  @UseGuards(AuthGuard)
  async lessons(@Query('grade') grade?: string, @Query('keyword') keyword?: string) {
    const g = Number(grade);
    return this.prisma.lesson.findMany({
      where: {
        ...(Number.isFinite(g) && g > 0 ? { grade: g } : {}),
        ...(keyword ? { title: { contains: keyword } } : {}),
      },
      orderBy: { id: 'desc' },
    });
  }

  @Get('lessons/:id')
  @UseGuards(AuthGuard)
  async lesson(@Param('id') id: string) {
    return this.prisma.lesson.findUnique({ where: { id: Number(id) } });
  }

  @Post('lessons')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async createLesson(
    @CurrentUser() user: any,
    @Body()
    body: {
      id?: number;
      title: string;
      grade: number;
      unit?: string;
      content: string;
      translation?: string;
      audio?: string;
    },
  ) {
    if (body.id) {
      return this.prisma.lesson.update({
        where: { id: body.id },
        data: {
          title: body.title,
          grade: body.grade,
          unit: body.unit,
          content: body.content,
          translation: body.translation,
          audio: body.audio,
        },
      });
    }
    return this.prisma.lesson.create({
      data: {
        title: body.title,
        grade: body.grade,
        unit: body.unit || '',
        content: body.content,
        translation: body.translation || '',
        audio: body.audio || '',
        source: 'custom',
      },
    });
  }

  @Delete('lessons/:id')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async deleteLesson(@Param('id') id: string) {
    await this.prisma.lesson.delete({ where: { id: Number(id) } });
    return { ok: true };
  }

  // ---------- 单词 ----------
  @Get('words')
  @UseGuards(AuthGuard)
  async words(@Query('grade') grade?: string, @Query('unit') unit?: string, @Query('keyword') keyword?: string) {
    const g = Number(grade);
    return this.prisma.word.findMany({
      where: {
        ...(Number.isFinite(g) && g > 0 ? { grade: g } : {}),
        ...(unit ? { unit } : {}),
        ...(keyword ? { text: { contains: keyword } } : {}),
      },
      orderBy: [{ grade: 'asc' }, { unit: 'asc' }, { id: 'asc' }],
    });
  }

  /** 批量新增单词：body.items = [{text, phonetic, meaning, grade, unit}] */
  @Post('words')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async createWords(
    @Body() body: { items: { text: string; phonetic?: string; meaning?: string; grade: number; unit?: string }[] },
  ) {
    const items = (body.items || []).filter((i) => i.text);
    if (!items.length) throw new BadRequestException('没有可导入的单词');
    await this.prisma.word.createMany({
      data: items.map((i) => ({
        text: i.text.trim(),
        phonetic: i.phonetic || '',
        meaning: i.meaning || '',
        grade: Number(i.grade) || 3,
        unit: i.unit || '',
      })),
    });
    return { ok: true, count: items.length };
  }

  @Delete('words/:id')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  async deleteWord(@Param('id') id: string) {
    await this.prisma.word.delete({ where: { id: Number(id) } });
    return { ok: true };
  }

  // ---------- Excel / CSV 批量导入 ----------
  @Post('import')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  @UseInterceptors(FileInterceptor('file', { storage: imageStorage }))
  async importExcel(@UploadedFile() file: Express.Multer.File, @Body() body: { type?: string }) {
    if (!file) throw new BadRequestException('未选择文件');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(file.path);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const type = body.type || 'word';

    if (type === 'word') {
      const data = rows
        .map((r) => ({
          text: pick(r, ['word', '单词', 'Words', 'text']).trim(),
          phonetic: pick(r, ['phonetic', '音标']),
          meaning: pick(r, ['meaning', '释义', '中文', '翻译']),
          grade: Number(pick(r, ['grade', '年级']) || 3),
          unit: pick(r, ['unit', '单元', 'Unit']),
        }))
        .filter((i) => i.text);
      if (!data.length) throw new BadRequestException('未识别到单词数据，请检查表头');
      await this.prisma.word.createMany({ data });
      return { ok: true, count: data.length };
    }

    if (type === 'lesson') {
      const data = rows
        .map((r) => ({
          title: pick(r, ['title', '课文', '标题']),
          content: pick(r, ['content', '内容', '正文', 'text']),
          translation: pick(r, ['translation', '翻译', '中文']),
          grade: Number(pick(r, ['grade', '年级']) || 3),
          unit: pick(r, ['unit', '单元']),
        }))
        .filter((i) => i.title && i.content);
      if (!data.length) throw new BadRequestException('未识别到课文数据，请检查表头');
      await this.prisma.lesson.createMany({ data });
      return { ok: true, count: data.length };
    }

    if (type === 'book') {
      // 绘本：每页一行，字段 book/page/image/text/translation
      const grouped = new Map<string, any[]>();
      rows.forEach((r) => {
        const title = pick(r, ['book', '绘本', '书名']);
        if (!title) return;
        if (!grouped.has(title)) grouped.set(title, []);
        grouped.get(title).push(r);
      });
      let count = 0;
      for (const [title, list] of grouped.entries()) {
        const book = await this.prisma.book.create({
          data: {
            title,
            grade: Number(pick(list[0], ['grade', '年级']) || 3),
            description: pick(list[0], ['description', '简介']),
            cover: pick(list[0], ['cover', '封面']),
            source: 'excel',
          },
        });
        await this.prisma.bookPage.createMany({
          data: list.map((r, i) => ({
            bookId: book.id,
            pageNo: Number(pick(r, ['page', '页码'])) || i + 1,
            text: pick(r, ['text', '正文', '内容']),
            translation: pick(r, ['translation', '翻译', '中文']),
            image: pick(r, ['image', '图片', '配图']),
          })),
        });
        count++;
      }
      return { ok: true, count };
    }

    throw new BadRequestException('未知的导入类型');
  }

  // ---------- OCR：拍照识别 ----------
  @Post('ocr')
  @UseGuards(AuthGuard)
  @Roles('teacher')
  @UseInterceptors(FileInterceptor('file', { storage: imageStorage }))
  async ocr(@UploadedFile() file: Express.Multer.File, @Body() body: { imageUrl?: string }) {
    const url = file ? publicUrl('image', file.filename) : body.imageUrl;
    if (!url) throw new BadRequestException('缺少图片');
    const result = await ocrImage({ imageUrl: url });
    return { ok: true, ...result, imageUrl: url };
  }
}

@Module({ controllers: [ContentController] })
export class ContentModule {}
