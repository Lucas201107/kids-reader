const { api } = require('../../utils/api.js');
const { startRecord, stopRecord, play } = require('../../utils/recorder.js');

Page({
  data: {
    type: 'word',
    id: 0,
    ids: [],
    idx: 0,
    assignmentId: '',
    title: '',
    text: '',
    translation: '',
    audio: '',
    image: '',
    words: [], // 评测后的逐词结果
    recording: false,
    tipRecording: '正在录音…',
    result: null,
    hasNext: false,
    indexText: '',
  },

  onLoad(options) {
    const ids = options.ids ? options.ids.split(',').map(Number) : [];
    const idx = ids.indexOf(Number(options.id));
    this.setData({
      type: options.type || 'word',
      id: Number(options.id) || 0,
      ids,
      idx,
      assignmentId: options.assignmentId || '',
      title: options.title ? decodeURIComponent(options.title) : '',
      text: options.text ? decodeURIComponent(options.text) : '',
      hasNext: ids.length > 1 && idx < ids.length - 1,
      indexText: ids.length > 1 ? `${idx + 1}/${ids.length}` : '',
    });
    this.loadContent();
  },

  loadContent() {
    const { type, id, text } = this.data;
    // 错词本等场景直接带原文进来（没有内容 ID）
    if (!id) {
      if (text) this.setData({ text, title: this.data.title || text });
      return;
    }
    api
      .detail(type, id)
      .then((d) => {
        if (!d) {
          wx.showToast({ title: '内容不存在', icon: 'none' });
          return;
        }
        this.setData({
          title: this.data.title || d.title,
          text: d.text,
          translation: d.translation,
          audio: d.audio,
          image: d.image,
        });
      })
      .catch(() => {});
  },

  toggleRecord() {
    if (this.data.recording) {
      this.stopAndEvaluate();
    } else {
      this.start();
    }
  },

  start() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        startRecord().then(() => {
          this.setData({ recording: true });
          wx.showToast({ title: '开始录音', icon: 'none' });
        });
      },
      fail: () => wx.showToast({ title: '需要录音权限', icon: 'none' }),
    });
  },

  stopAndEvaluate() {
    stopRecord()
      .then(({ path }) => {
        this.setData({ recording: false });
        wx.showLoading({ title: '评测中', mask: true });
        const { type, id, assignmentId } = this.data;
        return api.evaluate(path, {
          refType: type,
          refId: String(id),
          refText: this.data.text,
          refTitle: this.data.title,
          assignmentId: assignmentId ? String(assignmentId) : '',
        });
      })
      .then((res) => {
        wx.hideLoading();
        const words = (res.words || []).map((w) => {
          let cls = 'w-ok';
          if (w.matchTag === 1) cls = 'w-miss';
          else if (w.matchTag === 2) cls = 'w-warn';
          else if (w.matchTag === 3 || w.score < 60) cls = 'w-bad';
          else if (w.score < 75) cls = 'w-warn';
          return { ...w, cls };
        });
        this.setData({ result: res, words });
      })
      .catch((err) => {
        wx.hideLoading();
        if (err && err.message !== '录音太短') wx.showToast({ title: '评测失败', icon: 'none' });
      });
  },

  tapWord(e) {
    const w = e.currentTarget.dataset.w;
    wx.showToast({ title: w, icon: 'none' });
  },

  playDemo() {
    play(this.data.audio);
  },
  playMine() {
    play(this.data.result.audioUrl);
  },

  again() {
    this.setData({ result: null, words: [] });
  },

  next() {
    const { ids, idx, type, assignmentId } = this.data;
    const nextId = ids[idx + 1];
    wx.redirectTo({
      url: `/pages/reader/reader?type=${type}&id=${nextId}&ids=${ids.join(',')}&assignmentId=${assignmentId}`,
    });
  },

  finish() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/index/index' }),
    });
  },
});
