import axios from 'axios';

const API = 'https://api.weixin.qq.com/sns/jscode2session';

export interface WxSession {
  openid: string;
  session_key?: string;
  unionid?: string;
}

/**
 * 微信登录：code 换 openid。
 * 未配置真实 appid/secret 时返回开发态 openid，方便本地联调。
 */
export async function code2Session(code: string): Promise<WxSession> {
  const appid = process.env.WECHAT_APPID || '';
  const secret = process.env.WECHAT_SECRET || '';

  if (!appid || appid.startsWith('wxXXX') || !secret || secret.startsWith('xxxx')) {
    return { openid: `dev-openid-${code || 'demo'}`, session_key: 'dev' };
  }

  const { data } = await axios.get(API, {
    params: { appid, secret, js_code: code, grant_type: 'authorization_code' },
    timeout: 8000,
  });
  if (data.errcode) throw new Error(`微信登录失败: ${data.errcode} ${data.errmsg}`);
  return data as WxSession;
}
