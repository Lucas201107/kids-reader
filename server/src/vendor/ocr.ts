/**
 * 腾讯云 OCR 适配层：绘本 / 课本拍照 → 英文文本
 * 文档：https://cloud.tencent.com/document/product/866/33526
 */
export async function ocrImage(params: {
  imageUrl?: string;
  imageBase64?: string;
}): Promise<{ text: string; lines: string[] }> {
  const secretId = process.env.TENCENT_SECRET_ID || '';
  const secretKey = process.env.TENCENT_SECRET_KEY || '';
  const region = process.env.TENCENT_REGION || 'ap-guangzhou';

  if (!secretId || secretId.startsWith('AKIDxxx')) {
    // 未配置密钥：返回提示文本，前端可手动编辑
    return {
      text: '（未配置腾讯云 OCR 密钥，请手动录入或粘贴文本）',
      lines: [],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tencentcloud = require('tencentcloud-sdk-nodejs-ocr');
  const OcrClient = tencentcloud.ocr.v20181119.Client;
  const client = new OcrClient({
    credential: { secretId, secretKey },
    region,
    profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com' } },
  });

  const req: any = { LanguageType: 'auto' };
  if (params.imageUrl) req.ImageUrl = params.imageUrl;
  if (params.imageBase64) req.ImageBase64 = params.imageBase64;

  const res = await client.GeneralBasicOCR(req);
  const lines = (res.TextDetections || []).map((t: any) => t.DetectedText).filter(Boolean);
  return { text: lines.join('\n'), lines };
}
