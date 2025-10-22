// 全局应用逻辑（可扩展）
App({
  onLaunch() {
    // 初始化默认属性（如果未存在）
    const storage = require('./utils/storage.js');
    storage.initDefaults();

    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id',  // 请将 your-env-id 替换为你的云开发环境 ID
        traceUser: true,     // 是否记录用户访问记录
      });
    }
  }
});
