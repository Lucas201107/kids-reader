// 录音管理：小程序侧统一封装，输出 mp3 临时文件
let recorder = null;

function getRecorder() {
  if (!recorder) recorder = wx.getRecorderManager();
  return recorder;
}

function startRecord() {
  return new Promise((resolve, reject) => {
    const rm = getRecorder();
    rm.onError((err) => {
      wx.hideLoading();
      wx.showToast({ title: '录音失败: ' + (err.errMsg || ''), icon: 'none' });
      reject(err);
    });
    rm.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    });
    resolve();
  });
}

function stopRecord() {
  return new Promise((resolve, reject) => {
    const rm = getRecorder();
    rm.onStop((res) => {
      if (!res || !res.tempFilePath) {
        reject(new Error('未获取到录音文件'));
        return;
      }
      if (res.duration && res.duration < 500) {
        wx.showToast({ title: '录音太短啦', icon: 'none' });
        reject(new Error('录音太短'));
        return;
      }
      resolve({ path: res.tempFilePath, duration: res.duration });
    });
    rm.stop();
  });
}

/** 播放音频 */
function play(url) {
  if (!url) return;
  const ctx = wx.createInnerAudioContext();
  ctx.src = url;
  ctx.play();
  ctx.onError(() => wx.showToast({ title: '播放失败', icon: 'none' }));
}

module.exports = { startRecord, stopRecord, play };
