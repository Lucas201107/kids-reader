/**
 * 种子数据导入：npm run seed
 * 会清空 source='seed' 的旧数据后重新写入，方便反复执行。
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf-8'));

async function main() {
  console.log('清空旧的种子数据...');
  await prisma.bookPage.deleteMany({ where: { book: { source: 'seed' } } });
  await prisma.book.deleteMany({ where: { source: 'seed' } });
  await prisma.lesson.deleteMany({ where: { source: 'seed' } });
  await prisma.word.deleteMany({ where: { source: 'seed' } });

  const words = data.words.map((w: any) => ({ ...w, source: 'seed' }));
  await prisma.word.createMany({ data: words });
  console.log(`单词：${words.length} 个`);

  const lessons = data.lessons.map((l: any) => ({ ...l, source: 'seed' }));
  await prisma.lesson.createMany({ data: lessons });
  console.log(`课文：${lessons.length} 篇`);

  for (const b of data.books) {
    const { pages, ...rest } = b;
    await prisma.book.create({
      data: {
        ...rest,
        source: 'seed',
        pages: { create: pages.map((p: any) => ({ ...p, translation: p.translation || '' })) },
      },
    });
  }
  console.log(`绘本：${data.books.length} 本`);
  console.log('种子数据导入完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
