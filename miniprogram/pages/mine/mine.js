const { api, clearToken } = require('../../utils/api.js');

Page({
  data: {
    user: {},
    tab: 'stat',
    code: '',
    stats: null,
    wrongWords: [],
  },

  onLoad(options) {
    if (options.tab) this.setData({ tab: options.tab });
  },

  onShow() {
    api
      .me()
      .then((res) => {
        this.setData({ user: res.user });
        getApp().globalData.user = res.user;
      })
      .catch(() => {});
    this.loadStats();
    this.loadWrong();
  },

  loadStats() {
    api
      .statsMe()
      .then((stats) => this.setData({ stats }))
      .catch(() => {});
  },

  loadWrong() {
    api
      .wrongWords()
      .then((list) => this.setData({ wrongWords: (list || []).map((w) => ({ ...w, lastScore: Math.round(w.lastScore) })) }))
      .catch(() => {});
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  onCode(e) {
    this.setData({ code: e.detail.value });
  },

  joinClass() {
    const code = (this.data.code || '').trim().toUpperCase();
    if (code.length < 4) return wx.showToast({ title: '请输入班级码', icon: 'none' });
    api.joinClass(code).then((res) => {
      if (!res.ok) return wx.showToast({ title: res.message || '加入失败', icon: 'none' });
      wx.showToast({ title: '加入成功' });
      this.onShow();
    });
  },

  leaveClass() {
    wx.showModal({
      title: '退出班级',
      content: '确定退出当前班级吗？',
      success: (r) => {
        if (!r.confirm) return;
        api.leaveClass().then(() => this.onShow());
      },
    });
  },

  read(e) {
    const word = e.currentTarget.dataset.word;
    wx.navigateTo({
      url: `/pages/reader/reader?type=word&id=0&text=${encodeURIComponent(word)}&title=${encodeURIComponent(word)}`,
    });
  },

  /** 长按错词可移出错词本 */
  removeWrong(e) {
    const { id, word } = e.currentTarget.dataset;
    wx.showModal({
      title: '移出错词本',
      content: `已经掌握「${word}」了吗？`,
      success: (r) => {
        if (!r.confirm) return;
        api.removeWrongWord(id).then(() => {
          wx.showToast({ title: '已移除' });
          this.loadWrong();
        });
      },
    });
  },

  goTeacher() {
    wx.navigateTo({ url: '/pages/teacher/teacher' });
  },

  logout() {
    clearToken();
    getApp().globalData.user = null;
    wx.reLaunch({ url: '/pages/login/login' });
  },
});
