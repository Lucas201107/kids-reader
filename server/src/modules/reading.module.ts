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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { audioStorage, publicUrl } from '../common/upload.util';
import { evaluatePronunciation, SoeWord } from '../vendor/soe';

const WORD_THRESHOLD = () => Number(process.env.SOE_WORD_SCORE_THRESHOLD || 60);

@Controller('reading')
@UseGuards(AuthGuard)
export class ReadingController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 跟读评测核心接口
   * form-data: file=录音文件, refType=word|lesson|bookPage, refId, refText(可选，缺省时按 refId 取库), refTitle, assignmentId
   */
  @Post('evaluate')
  @UseInterceptors(FileInterceptor('file', { storage: audioStorage }))
  async evaluate(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      refType: string;
      refId?: string;
      refText?: string;
      refTitle?: string;
      assignmentId?: string;
      evalMode?: string;
    },
  ) {
    let refText = (body.refText || '').trim();
    let refTitle = body.refTitle || '';
    const refType = body.refType || 'word';
    const refId = Number(body.refId) || 0;

    // 每日练习次数上限（DAILY_LIMIT<=0 表示不限制），用于控制 SOE 调用成本
    const dailyLimit = Number(process.env.DAILY_LIMIT || 0);
    if (dailyLimit > 0) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const todayCount = await this.prisma.readingRecord.count({
        where: { userId: user.sub, createdAt: { gte: start } },
      });
      if (todayCount >= dailyLimit) {
        throw new ForbiddenException(`今日练习次数已达上限（${dailyLimit} 次），明天再来吧`);
      }
    }

    if (!refText && refId) {
      if (refType === 'word') {
        const w = await this.prisma.word.findUnique({ where: { id: refId } });
        refText = w?.text || '';
        refTitle = refTitle || w?.text || '';
      } else if (refType === 'lesson') {
        const l = await this.prisma.lesson.findUnique({ where: { id: refId } });
        refText = l?.content || '';
        refTitle = refTitle || l?.title || '';
      } else if (refType === 'bookPage') {
        const p = await this.prisma.bookPage.findUnique({ where: { id: refId } });
        refText = p?.text || '';
        refTitle = refTitle || p?.text?.slice(0, 20) || '';
      }
    }
    if (!refText) throw new BadRequestException('缺少跟读原文');

    const audioUrl = file ? publicUrl('audio', file.filename) : '';
    const evalMode =
      body.evalMode || (refType === 'word' ? 'word' : refText.split(/\s+/).length > 24 ? 'paragraph' : 'sentence');

    const result = await evaluatePronunciation({
      refText,
      audioUrl,
      fileType: 2, // mp3
      evalMode,
    });

    const threshold = WORD_THRESHOLD();
    const words: SoeWord[] = result.words?.length
      ? result.words
      : [{ word: refText, score: result.accuracy, matchTag: 0 }];

    // 判定需要纠正的词：漏读 / 多读 / 错读，或发音分低于阈值
    const wrongWords = words.filter((w) => w.matchTag !== 0 || w.score < threshold).map((w) => w.word);

    const record = await this.prisma.readingRecord.create({
      data: {
        userId: user.sub,
        refType,
        refId,
        refTitle,
        refText,
        audioUrl,
        score: result.score,
        accuracy: result.accuracy,
        fluency: result.fluency,
        completeness: result.completeness,
        detail: JSON.stringify(words),
        wrongWords: JSON.stringify(wrongWords),
        assignmentId: body.assignmentId ? Number(body.assignmentId) : null,
      },
    });

    // 累加错词本
    for (const w of Array.from(new Set(wrongWords))) {
      const clean = String(w).replace(/[^\w'-]/g, '').toLowerCase();
      if (!clean) continue;
      const exist = await this.prisma.wrongWord.findUnique({
        where: { userId_word: { userId: user.sub, word: clean } },
      });
      const score = words.find((x) => x.word === w)?.score || 0;
      if (exist) {
        await this.prisma.wrongWord.update({
          where: { id: exist.id },
          data: { count: exist.count + 1, lastScore: score },
        });
      } else {
        await this.prisma.wrongWord.create({
          data: { userId: user.sub, word: clean, count: 1, lastScore: score },
        });
      }
    }

    return {
      id: record.id,
      score: result.score,
      accuracy: result.accuracy,
      fluency: result.fluency,
      completeness: result.completeness,
      words,
      wrongWords,
      audioUrl,
      refText,
      mocked: result.mocked,
    };
  }

  /** 我的跟读历史 */
  @Get('records')
  async records(@CurrentUser() user: any, @Query('limit') limit?: string, @Query('refType') refType?: string) {
    return this.prisma.readingRecord.findMany({
      where: { userId: user.sub, ...(refType ? { refType } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 50,
    });
  }

  /** 某内容的最好成绩（用于列表页展示星级） */
  @Get('best')
  async best(@CurrentUser() user: any, @Query('refType') refType: string, @Query('refIds') refIds: string) {
    const ids = (refIds || '').split(',').map(Number).filter(Boolean);
    if (!ids.length) return {};
    const rows = await this.prisma.readingRecord.groupBy({
      by: ['refId'],
      where: { userId: user.sub, refType, refId: { in: ids } },
      _max: { score: true },
    });
    const map: Record<string, number> = {};
    rows.forEach((r) => (map[r.refId] = Math.round(r._max.score || 0)));
    return map;
  }

  /** 我的错词本 */
  @Get('wrong-words')
  async wrongWords(@CurrentUser() user: any) {
    return this.prisma.wrongWord.findMany({
      where: { userId: user.sub },
      orderBy: [{ count: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  @Delete('wrong-words/:id')
  async deleteWrongWord(@CurrentUser() user: any, @Param('id') id: string) {
    await this.prisma.wrongWord.deleteMany({ where: { id: Number(id), userId: user.sub } });
    return { ok: true };
  }
}

@Module({ controllers: [ReadingController] })
export class ReadingModule {}
