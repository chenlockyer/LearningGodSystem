const API_BASE_URL = 'http://8.163.51.135:3000';

// 全局应用逻辑（可扩展）
App({
  globalData: {
    // 用户登录信息（通过微信登录获取）
    // { openid, session_key, unionid }
    user: null
  },

  onLaunch() {
    console.log('应用启动');
    
    // 初始化默认属性（如果未存在）
    const storage = require('./utils/storage.js');
    storage.initDefaults();

    // 自动检查并尝试登录，获取 openid 用于区分用户
    this.checkLogin();

    // 检查后端服务连接（可选）
    // const ai = require('./utils/ai.js');
    // ai.checkAIService().then(available => {
    //   if (!available) {
    //     console.warn('AI服务不可用，请检查后端服务是否启动');
    //   }
    // });
  },

  // 从本地恢复登录状态或发起微信登录
  checkLogin() {
    try {
      const cached = wx.getStorageSync('mp_user_v1');
      if (cached && cached.openid) {
        this.globalData.user = cached;
        console.log('已从本地恢复用户登录状态:', cached.openid);
        return;
      }
    } catch (e) {
      console.warn('读取本地用户信息失败:', e);
    }

    // 本地没有用户信息，则发起登录
    this.login();
  },

  // 微信登录：code 换取 openid（经由本地 Node 服务器）
  login(callback) {
    console.log('开始微信登录');
    wx.login({
      success: (res) => {
        if (!res.code) {
          console.error('wx.login 未返回 code:', res);
          if (callback) callback(new Error('登录失败：未获取到 code'));
          return;
        }

        wx.request({
          url: `${API_BASE_URL}/api/login`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json'
          },
          data: {
            code: res.code
          },
          success: (resp) => {
            if (resp.statusCode === 200 && resp.data && resp.data.code === 0) {
              const data = resp.data.data || {};
              const user = {
                openid: data.openid,
                session_key: data.session_key,
                unionid: data.unionid || null
              };
              this.globalData.user = user;
              try {
                wx.setStorageSync('mp_user_v1', user);
              } catch (e) {
                console.warn('缓存用户信息失败:', e);
              }
              console.log('登录成功，openid:', user.openid);
              if (callback) callback(null, user);
            } else {
              const msg = resp.data?.msg || '登录接口返回错误';
              console.error('登录接口错误:', msg, resp.data);
              if (callback) callback(new Error(msg));
            }
          },
          fail: (err) => {
            console.error('调用登录接口失败:', err);
            if (callback) callback(new Error(err.errMsg || '网络错误'));
          }
        });
      },
      fail: (err) => {
        console.error('wx.login 调用失败:', err);
        if (callback) callback(new Error(err.errMsg || '微信登录失败'));
      }
    });
  },

  onShow() {
    console.log('应用显示');
  },

  onHide() {
    console.log('应用隐藏');
  },

  onError(error) {
    console.error('应用错误:', error);
  }
});
