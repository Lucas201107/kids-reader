const { api } = require('../../utils/api.js');

Page({
  data: {
    tab: 'class',
    classes: [],
    className: '',
    newGrade: 3,

    assign: { classId: 0, title: '', type: 'word', refIds: [] },
    candidates: [],

    statClassId: 0,
    stat: null,

    contentType: 'word',
    wordText: '',
    wordGrade: 3,
    wordUnit: '',
    lesson: { title: '', content: '', translation: '', grade: 3 },
    book: { title: '', pagesText: '', grade: 3 },
  },

  onShow() {
    this.loadClasses();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  loadClasses() {
    api
      .myClasses()
      .then((list) => {
        this.setData({ classes: list || [] });
        if (!this.data.assign.classId && list && list.length) {
          this.setData({ 'assign.classId': list[0].id });
        }
        if (!this.data.statClassId && list && list.length) {
          this.setData({ statClassId: list[0].id }, () => this.loadStat());
        }
      })
      .catch(() => {});
  },

  // ---------- 班级 ----------
  onClassName(e) {
    this.setData({ className: e.detail.value });
  },
  pickNewGrade(e) {
    this.setData({ newGrade: Number(e.currentTarget.dataset.g) });
  },
  createClass() {
    const name = this.data.className.trim();
    if (!name) return wx.showToast({ title: '请填写班级名称', icon: 'none' });
    api
      .createClass({ name, grade: this.data.newGrade })
      .then(() => {
        wx.showToast({ title: '创建成功' });
        this.setData({ className: '' });
        this.loadClasses();
      })
      .catch(() => wx.showToast({ title: '创建失败', icon: 'none' }));
  },
  copyCode(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.code });
  },

  // ---------- 布置任务 ----------
  pickClass(e) {
    this.setData({ 'assign.classId': Number(e.currentTarget.dataset.id), candidates: [] }, () => this.loadCandidates());
  },
  onAssignTitle(e) {
    this.setData({ 'assign.title': e.detail.value });
  },
  pickType(e) {
    this.setData({ 'assign.type': e.currentTarget.dataset.t, candidates: [] }, () => this.loadCandidates());
  },
  loadCandidates() {
    const type = this.data.assign.type;
    const req = type === 'word' ? api.words({}) : type === 'lesson' ? api.lessons({}) : api.books({});
    req.then((list) => {
      const ids = this.data.assign.refIds;
      this.setData({
        candidates: (list || []).map((i) => ({
          id: i.id,
          title: i.title || i.text || i.word,
          checked: ids.includes(i.id),
        })),
      });
    });
  },
  toggleCandidate(e) {
    const id = Number(e.currentTarget.dataset.id);
    const ids = this.data.assign.refIds.slice();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1);
    else ids.push(id);
    const candidates = this.data.candidates.map((c) => ({ ...c, checked: ids.includes(c.id) }));
    this.setData({ 'assign.refIds': ids, candidates });
  },
  submitAssign() {
    const { classId, title, type, refIds } = this.data.assign;
    if (!classId) return wx.showToast({ title: '请选择班级', icon: 'none' });
    if (!title.trim()) return wx.showToast({ title: '请填写标题', icon: 'none' });
    if (!refIds.length) return wx.showToast({ title: '请勾选内容', icon: 'none' });
    api
      .createAssignment({ classId, title: title.trim(), type, refIds })
      .then(() => {
        wx.showToast({ title: '布置成功' });
        this.setData({ 'assign.title': '', 'assign.refIds': [] });
      })
      .catch(() => wx.showToast({ title: '布置失败', icon: 'none' }));
  },

  // ---------- 数据 ----------
  pickStatClass(e) {
    this.setData({ statClassId: Number(e.currentTarget.dataset.id) }, () => this.loadStat());
  },
  loadStat() {
    if (!this.data.statClassId) return;
    api
      .statsClass(this.data.statClassId, 30)
      .then((res) => this.setData({ stat: res.ok ? res : null }))
      .catch(() => {});
  },

  /** 复制高频错词，方便老师粘贴到备课文档里做课堂带读 */
  copyWrongWords() {
    const list = (this.data.stat && this.data.stat.topWrongWords) || [];
    if (!list.length) return wx.showToast({ title: '暂无错词数据', icon: 'none' });
    wx.setClipboardData({
      data: list.map((w) => `${w.word} ×${w.count}`).join('\n'),
      success: () => wx.showToast({ title: '错词已复制', icon: 'none' }),
    });
  },

  /** 复制一份可粘贴到班级群的文字版学习报告 */
  copyReport() {
    const s = this.data.stat;
    if (!s) return;
    const lines = [
      `【${s.class.name}】近 30 天学习报告`,
      `活跃人数：${s.activeCount} / ${s.memberCount}`,
      `跟读总次数：${s.totalRecords}`,
      `全班平均分：${s.avgScore}`,
      '',
      `高频错词：${s.topWrongWords.map((w) => `${w.word}(${w.count})`).join('、') || '暂无'}`,
      '',
      '学生排行：',
      ...s.ranking.map((r, i) => `${i + 1}. ${r.nickname} — ${r.count} 次，均分 ${r.avgScore}`),
    ];
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '报告已复制', icon: 'none' }),
    });
  },

  // ---------- 录入内容 ----------
  pickContentType(e) {
    this.setData({ contentType: e.currentTarget.dataset.c });
  },
  onWordText(e) {
    this.setData({ wordText: e.detail.value });
  },
  pickWordGrade(e) {
    this.setData({ wordGrade: Number(e.currentTarget.dataset.g) });
  },
  onWordUnit(e) {
    this.setData({ wordUnit: e.detail.value });
  },
  submitWords() {
    const lines = this.data.wordText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return wx.showToast({ title: '请输入单词', icon: 'none' });
    const items = lines.map((l) => {
      const [text, ...rest] = l.split(/\s+/);
      return { text, meaning: rest.join(' '), grade: this.data.wordGrade, unit: this.data.wordUnit };
    });
    api
      .createWords({ items })
      .then((r) => {
        wx.showToast({ title: `已添加 ${r.count} 个` });
        this.setData({ wordText: '' });
      })
      .catch(() => wx.showToast({ title: '保存失败', icon: 'none' }));
  },

  onLessonTitle: onInput('lesson.title'),
  onLessonContent: onInput('lesson.content'),
  onLessonTrans: onInput('lesson.translation'),
  pickLessonGrade(e) {
    this.setData({ 'lesson.grade': Number(e.currentTarget.dataset.g) });
  },
  submitLesson() {
    const l = this.data.lesson;
    if (!l.title.trim() || !l.content.trim()) return wx.showToast({ title: '请填写标题和正文', icon: 'none' });
    api
      .createLesson({ ...l, title: l.title.trim(), content: l.content.trim() })
      .then(() => {
        wx.showToast({ title: '保存成功' });
        this.setData({ lesson: { title: '', content: '', translation: '', grade: l.grade } });
      })
      .catch(() => wx.showToast({ title: '保存失败', icon: 'none' }));
  },

  onBookTitle: onInput('book.title'),
  onBookPages: onInput('book.pagesText'),
  pickBookGrade(e) {
    this.setData({ 'book.grade': Number(e.currentTarget.dataset.g) });
  },
  submitBook() {
    const b = this.data.book;
    if (!b.title.trim() || !b.pagesText.trim()) return wx.showToast({ title: '请填写标题和分页内容', icon: 'none' });
    const pages = b.pagesText
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ text }));
    api
      .createBook({ title: b.title.trim(), grade: b.grade, pages })
      .then(() => {
        wx.showToast({ title: '保存成功' });
        this.setData({ book: { title: '', pagesText: '', grade: b.grade } });
      })
      .catch(() => wx.showToast({ title: '保存失败', icon: 'none' }));
  },
});

function onInput(key) {
  return function (e) {
    this.setData({ [key]: e.detail.value });
  };
}
