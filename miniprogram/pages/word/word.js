const { api } = require('../../utils/api.js');

Page({
  data: {
    grades: [3, 4, 5, 6],
    grade: 3,
    mode: 'all', // all | wrong
    list: [],
  },

  onShow() {
    const app = getApp();
    const user = app.globalData.user || {};
    if (user.grade) this.setData({ grade: user.grade });
    this.load();
  },

  pickGrade(e) {
    this.setData({ grade: Number(e.currentTarget.dataset.g), mode: 'all', list: [] }, () => this.load());
  },

  toggleWrong() {
    const mode = this.data.mode === 'wrong' ? 'all' : 'wrong';
    this.setData({ mode, list: [] }, () => this.load());
  },

  load() {
    if (this.data.mode === 'wrong') {
      api
        .wrongWords()
        .then((list) =>
          this.setData({
            list: (list || []).map((w) => ({
              id: 0, // 0 表示没有内容 ID，跟读时直接传原文
              wid: w.id, // 错词记录 ID，用于移除
              text: w.word,
              phonetic: '',
              meaning: '',
              count: w.count,
              lastScore: Math.round(w.lastScore),
            })),
          })
        )
        .catch(() => {});
      return;
    }
    api
      .words({ grade: this.data.grade })
      .then((list) => this.setData({ list: list || [] }))
      .catch(() => {});
  },

  read(e) {
    const { id, text } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/reader/reader?type=word&id=${id}` });
      return;
    }
    // 错词本里的词没有内容 ID，直接把原文带过去
    wx.navigateTo({
      url: `/pages/reader/reader?type=word&id=0&text=${encodeURIComponent(text)}&title=${encodeURIComponent(text)}`,
    });
  },

  /** 长按错词可移出错词本 */
  removeWrong(e) {
    const { wid, text } = e.currentTarget.dataset;
    if (!wid) return;
    wx.showModal({
      title: '移出错词本',
      content: `已经掌握「${text}」了吗？`,
      success: (r) => {
        if (!r.confirm) return;
        api.removeWrongWord(wid).then(() => {
          wx.showToast({ title: '已移除' });
          this.load();
        });
      },
    });
  },
});
