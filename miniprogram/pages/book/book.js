const { api } = require('../../utils/api.js');

Page({
  data: {
    tab: 'book',
    grades: [3, 4, 5, 6],
    grade: 3,
    list: [],
  },

  onLoad(options) {
    this.setData({ tab: options.tab || 'book' });
  },

  onShow() {
    const app = getApp();
    const user = app.globalData.user || {};
    if (user.grade) this.setData({ grade: user.grade });
    this.load();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab, list: [] }, () => this.load());
  },

  pickGrade(e) {
    this.setData({ grade: Number(e.currentTarget.dataset.g), list: [] }, () => this.load());
  },

  load() {
    const { tab, grade } = this.data;
    const req = tab === 'book' ? api.books({ grade }) : api.lessons({ grade });
    req
      .then((list) => this.setData({ list: list || [] }))
      .catch(() => {});
  },

  open(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.tab === 'lesson') {
      wx.navigateTo({ url: `/pages/reader/reader?type=lesson&id=${id}` });
      return;
    }
    // 绘本：取所有页，按顺序跟读
    wx.showLoading({ title: '加载中' });
    api
      .book(id)
      .then((book) => {
        wx.hideLoading();
        const pages = (book.pages || []).sort((a, b) => a.pageNo - b.pageNo);
        if (!pages.length) {
          wx.showToast({ title: '该绘本还没有内容页', icon: 'none' });
          return;
        }
        const ids = pages.map((p) => p.id).join(',');
        wx.navigateTo({
          url: `/pages/reader/reader?type=bookPage&id=${pages[0].id}&ids=${ids}&title=${encodeURIComponent(book.title)}`,
        });
      })
      .catch(() => wx.hideLoading());
  },
});
