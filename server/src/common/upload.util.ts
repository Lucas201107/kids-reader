import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || './uploads');

/** multer 磁盘存储：按子目录归类（audio / image / import） */
export function diskStorage(subDir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(UPLOAD_ROOT, subDir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.bin';
      const name = crypto.randomBytes(8).toString('hex') + ext.toLowerCase();
      cb(null, name);
    },
  });
}

/** 生成外网可访问的 URL，供 SOE / OCR 回调或前端展示 */
export function publicUrl(subDir: string, filename: string): string {
  const base = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  return `${base}/static/${subDir}/${filename}`;
}

export const imageStorage = diskStorage('image');
export const audioStorage = diskStorage('audio');
export const fileStorage = diskStorage('file');
