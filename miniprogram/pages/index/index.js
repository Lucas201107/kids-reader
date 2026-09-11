const { api, getToken } = require('../../utils/api.js');

const TYPE_NAME = { word: '单词', lesson: '课文', book: '绘本', bookPage: '绘本' };

Page({
  data: {
    user: {},
    classId: null,
    className: '',
    code: '',
    tasks: [],
    stats: null,
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.load();
  },

  load() {
    api
      .me()
      .then((res) => {
        const user = res.user;
        this.setData({ user, classId: user.classId, className: user.className });
        if (user.classId) {
          return api.assignments(user.classId);
        }
        return [];
      })
      .then((list) => {
        const tasks = (list || []).map((t) => ({
          ...t,
          typeName: TYPE_NAME[t.type] || '跟读',
          myAvg: t.myScores && t.myScores.length
            ? Math.round(t.myScores.reduce((a, b) => a + b, 0) / t.myScores.length)
            : 0,
        }));
        this.setData({ tasks: tasks.filter((t) => !t.finished).concat(tasks.filter((t) => t.finished)).slice(0, 5) });
        return api.statsMe();
      })
      .then((stats) => this.setData({ stats }))
      .catch(() => {});
  },

  onCode(e) {
    this.setData({ code: e.detail.value });
  },

  joinClass() {
    const code = (this.data.code || '').trim().toUpperCase();
    if (code.length < 4) {
      wx.showToast({ title: '请输入班级码', icon: 'none' });
      return;
    }
    api
      .joinClass(code)
      .then((res) => {
        if (!res.ok) {
          wx.showToast({ title: res.message || '加入失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '加入成功' });
        this.load();
      })
      .catch(() => {});
  },

  openTask(e) {
    const item = e.currentTarget.dataset.item;
    let ids = item.refIds || [];
    if (typeof ids === 'string') ids = JSON.parse(ids);
    if (!ids.length) {
      wx.showToast({ title: '任务没有内容', icon: 'none' });
      return;
    }
    const type = item.type === 'book' ? 'bookPage' : item.type;
    wx.navigateTo({
      url: `/pages/reader/reader?type=${type}&id=${ids[0]}&assignmentId=${item.id}&ids=${ids.join(',')}`,
    });
  },

  goTask() {
    wx.navigateTo({ url: '/pages/task/task' });
  },

  go(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  },
});
