App({
  globalData: {
    user: null,
    token: '',
  },

  onLaunch() {
    const token = wx.getStorageSync('kr_token');
    this.globalData.token = token;
    if (token) this.refreshUser();
  },

  refreshUser() {
    const { api } = require('./utils/api.js');
    return api
      .me()
      .then((res) => {
        this.globalData.user = res.user;
        this.globalData.token = res.token;
        // token 续期
        if (res.token) wx.setStorageSync('kr_token', res.token);
        return res.user;
      })
      .catch(() => {
        this.globalData.user = null;
        return null;
      });
  },

  isLogin() {
    return !!wx.getStorageSync('kr_token');
  },
});
