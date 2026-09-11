const { api } = require('../../utils/api.js');

const TYPE_NAME = { word: '单词', lesson: '课文', book: '绘本' };

Page({
  data: {
    list: [],
  },

  onShow() {
    api
      .me()
      .then((res) => (res.user.classId ? api.assignments(res.user.classId) : []))
      .then((list) => {
        this.setData({
          list: (list || []).map((t) => ({
            ...t,
            refIds: t.refIds || [],
            typeName: TYPE_NAME[t.type] || '跟读',
            myAvg: t.myScores && t.myScores.length
              ? Math.round(t.myScores.reduce((a, b) => a + b, 0) / t.myScores.length)
              : 0,
            dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
          })),
        });
      })
      .catch(() => {});
  },

  open(e) {
    const item = e.currentTarget.dataset.item;
    const ids = item.refIds || [];
    if (!ids.length) return wx.showToast({ title: '任务没有内容', icon: 'none' });
    const type = item.type === 'book' ? 'bookPage' : item.type;
    wx.navigateTo({
      url: `/pages/reader/reader?type=${type}&id=${ids[0]}&assignmentId=${item.id}&ids=${ids.join(',')}`,
    });
  },
});
