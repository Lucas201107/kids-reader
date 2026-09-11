Page({
  data: {
    nickname: '',
    role: 'student',
    grades: [3, 4, 5, 6],
    grade: 3,
    secret: '',
  },

  onNickname(e) {
    this.setData({ nickname: e.detail.value });
  },
  onSecret(e) {
    this.setData({ secret: e.detail.value });
  },
  pickRole(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },
  pickGrade(e) {
    this.setData({ grade: Number(e.currentTarget.dataset.grade) });
  },

  submit() {
    const { nickname, role, grade, secret } = this.data;
    if (!nickname.trim()) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    if (role === 'teacher' && !secret.trim()) {
      wx.showToast({ title: '请填写教师邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中', mask: true });
    wx.login({
      success: (res) => {
        const { api, setToken } = require('../../utils/api.js');
        api
          .login({ code: res.code, nickname: nickname.trim(), role, grade })
          .then((r) => {
            setToken(r.token);
            if (role === 'teacher') {
              return api.updateProfile({ role: 'teacher', grade: null });
            }
            return api.updateProfile({ role: 'student', grade });
          })
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '登录成功' });
            setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 600);
          })
          .catch((err) => {
            wx.hideLoading();
            wx.showToast({ title: err.message || '登录失败', icon: 'none' });
          });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      },
    });
  },
});
