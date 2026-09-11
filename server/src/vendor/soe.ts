/**
 * 腾讯云智聆口语评测（SOE）适配层
 * 文档：https://cloud.tencent.com/document/product/884/71865
 *
 * 评测结果中的 MatchTag：0=正常 1=漏读 2=多读 3=错读
 * 未配置密钥或 MOCK_SOE=true 时返回模拟结果，保证开发期流程可跑通。
 */
import * as crypto from 'crypto';

export interface SoeWord {
  word: string;
  score: number; // 0-100
  matchTag: number; // 0 正常 1 漏读 2 多读 3 错读
  beginTime?: number;
  endTime?: number;
}

export interface SoeResult {
  score: number; // 综合分 0-100
  accuracy: number; // 发音准确度
  fluency: number; // 流利度
  completeness: number; // 完整度
  words: SoeWord[];
  raw?: any;
  mocked: boolean;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round((v || 0) * 10) / 10));

export async function evaluatePronunciation(params: {
  refText: string;
  audioUrl?: string;
  fileData?: string; // base64，二选一
  fileType?: number; // 1: wav/pcm  2: mp3
  evalMode?: string; // word | sentence | paragraph
}): Promise<SoeResult> {
  const secretId = process.env.TENCENT_SECRET_ID || '';
  const secretKey = process.env.TENCENT_SECRET_KEY || '';
  const region = process.env.TENCENT_REGION || 'ap-guangzhou';
  const useMock =
    process.env.MOCK_SOE === 'true' ||
    !secretId ||
    secretId.startsWith('AKIDxxx') ||
    (!params.audioUrl && !params.fileData);

  if (useMock) return mockEvaluate(params.refText);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tencentcloud = require('tencentcloud-sdk-nodejs-soe');
    const SoeClient = tencentcloud.soe.v20200724.Client;
    const client = new SoeClient({
      credential: { secretId, secretKey },
      region,
      profile: { httpProfile: { endpoint: 'soe.tencentcloudapi.com', reqTimeout: 30 } },
    });

    const req: any = {
      SessionId: crypto.randomUUID(),
      RefText: params.refText,
      WorkMode: 1, // 1=非流式一次性评测（适合短音频）
      EvalMode: params.evalMode || process.env.SOE_EVAL_MODE || 'sentence',
      ScoreCoeff: 3.5, // 苛刻程度，越大越严格
      FileType: params.fileType || 2,
      IsAsync: 0,
      IsQuery: 0,
    };
    if (params.audioUrl) req.FileUrl = params.audioUrl;
    if (params.fileData) req.FileData = params.fileData;

    const res = await client.TransmitOralProcessWithInit(req);

    const words: SoeWord[] = (res.Words || []).map((w: any) => ({
      word: w.Word,
      score: clamp(w.PronAccuracy ?? w.MatchTag === 1 ? 0 : 80),
      matchTag: w.MatchTag ?? 0,
      beginTime: w.BeginTime,
      endTime: w.EndTime,
    }));

    const accuracy = clamp(res.PronAccuracy);
    const fluency = clamp(res.PronFluency);
    const completeness = clamp(res.PronCompletion);

    return {
      score: clamp(res.SuggestedScore ?? (accuracy * 0.6 + fluency * 0.2 + completeness * 0.2)),
      accuracy,
      fluency,
      completeness,
      words,
      raw: res,
      mocked: false,
    };
  } catch (e: any) {
    console.error('[SOE] 评测失败，降级使用模拟结果：', e?.message || e);
    return mockEvaluate(params.refText, true);
  }
}

function mockEvaluate(refText: string, fallback = false): SoeResult {
  const tokens = (refText || '').split(/\s+/).filter(Boolean);
  const words: SoeWord[] = tokens.map((t, i) => {
    // 稳定伪随机：同一个文本每次结果一致，便于调试
    const h = hash(t + i) % 100;
    let score = 80 + (h % 19); // 80-98
    let matchTag = 0;
    if (h < 12) {
      score = 35 + (h % 20); // 明显偏低的词
      matchTag = 3; // 错读
    }
    return { word: t, score, matchTag };
  });
  if (!words.length) words.push({ word: refText, score: 60, matchTag: 0 });

  const accuracy = clamp(words.reduce((s, w) => s + w.score, 0) / words.length);
  const fluency = clamp(accuracy - 3 + (hash(refText) % 7));
  const completeness = clamp(100 - (hash(refText) % 12));
  return {
    score: clamp(accuracy * 0.6 + fluency * 0.2 + completeness * 0.2),
    accuracy,
    fluency,
    completeness,
    words,
    mocked: true,
    raw: fallback ? { note: 'SOE 调用失败，返回模拟结果' } : { note: 'MOCK_SOE 模式' },
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
