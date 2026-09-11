// 后端地址：按小程序运行环境自动切换
//   develop = 微信开发者工具 / 真机调试
//   trial   = 体验版（班级内部使用主要跑这个）
//   release = 正式版
// 上线前把下面两处 example.com 换成你自己的备案域名
const ENV_BASE_URL = {
  develop: 'http://localhost:3000',
  trial: 'https://api.example.com',
  release: 'https://api.example.com',
};

function detectBaseUrl() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const env = (info && info.miniProgram && info.miniProgram.envVersion) || 'develop';
    return ENV_BASE_URL[env] || ENV_BASE_URL.develop;
  } catch (e) {
    return ENV_BASE_URL.develop;
  }
}

const BASE_URL = detectBaseUrl();

const TOKEN_KEY = 'kr_token';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}
function setToken(t) {
  wx.setStorageSync(TOKEN_KEY, t);
}
function clearToken() {
  wx.removeStorageSync(TOKEN_KEY);
}

// 401 统一处理：清 token 并回登录页（避免多请求并发时反复跳转）
let redirecting = false;
function handleUnauthorized() {
  clearToken();
  if (redirecting) return;
  redirecting = true;
  wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
  setTimeout(() => {
    wx.reLaunch({ url: '/pages/login/login' });
    redirecting = false;
  }, 900);
}

function buildUrl(path) {
  return `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
}

/** 统一请求：自动带 token，401 时引导重新登录 */
function request(path, options = {}) {
  const { method = 'GET', data, header = {}, loading = false, loadingText = '加载中' } = options;
  if (loading) wx.showLoading({ title: loadingText, mask: true });

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(path),
      method,
      data,
      header: {
        'content-type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        ...header,
      },
      success: (res) => {
        if (loading) wx.hideLoading();
        if (res.statusCode === 401) {
          handleUnauthorized();
          reject(new Error('登录已过期'));
          return;
        }
        if (res.statusCode >= 400 && res.data && res.data.message) {
          // 把后端的业务提示（如"今日练习次数已达上限"）透出给用户
          wx.showToast({ title: res.data.message, icon: 'none' });
          reject(new Error(res.data.message));
          return;
        }
        if (res.statusCode >= 500) {
          wx.showToast({ title: '服务异常', icon: 'none' });
          reject(new Error('服务异常'));
          return;
        }
        resolve(res.data);
      },
      fail: (err) => {
        if (loading) wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(err);
      },
    });
  });
}

const get = (path, data, opts) => request(path, { ...opts, method: 'GET', data });
const post = (path, data, opts) => request(path, { ...opts, method: 'POST', data });
const del = (path, data) => request(path, { method: 'DELETE', data });

/** 上传文件（录音 / 图片） */
function upload(path, filePath, formData = {}, name = 'file') {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '上传中', mask: true });
    wx.uploadFile({
      url: buildUrl(path),
      filePath,
      name,
      formData,
      header: { Authorization: `Bearer ${getToken()}` },
      success: (res) => {
        wx.hideLoading();
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode === 401) {
            handleUnauthorized();
            reject(new Error('登录已过期'));
          } else if (res.statusCode >= 400) {
            const tip = (data && data.message) || '上传失败';
            wx.showToast({ title: tip, icon: 'none' });
            reject(new Error(tip));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
        reject(err);
      },
    });
  });
}

// ===== 业务接口 =====
const api = {
  login: (data) => post('/api/auth/login', data),
  me: () => get('/api/auth/me'),
  updateProfile: (data) => post('/api/auth/profile', data),

  myClasses: () => get('/api/class/mine'),
  createClass: (data) => post('/api/class', data),
  joinClass: (code) => post('/api/class/join', { code }),
  classMembers: (id) => get(`/api/class/${id}/members`),
  leaveClass: () => post('/api/class/leave'),

  books: (params) => get('/api/content/books', params),
  book: (id) => get(`/api/content/books/${id}`),
  detail: (type, id) => get('/api/content/detail', { type, id }),
  lessons: (params) => get('/api/content/lessons', params),
  words: (params) => get('/api/content/words', params),
  createBook: (data) => post('/api/content/books', data),
  createLesson: (data) => post('/api/content/lessons', data),
  createWords: (data) => post('/api/content/words', data),

  evaluate: (filePath, formData) => upload('/api/reading/evaluate', filePath, formData),
  records: (params) => get('/api/reading/records', params),
  bestScores: (refType, refIds) => get('/api/reading/best', { refType, refIds: refIds.join(',') }),
  wrongWords: () => get('/api/reading/wrong-words'),
  removeWrongWord: (id) => del(`/api/reading/wrong-words/${id}`),

  assignments: (classId) => get('/api/assignment', { classId }),
  createAssignment: (data) => post('/api/assignment', data),
  assignmentDetail: (id) => get(`/api/assignment/${id}`),

  statsMe: () => get('/api/stats/me'),
  statsClass: (id, days) => get(`/api/stats/class/${id}`, { days }),
};

module.exports = { BASE_URL, getToken, setToken, clearToken, request, get, post, del, upload, api };
