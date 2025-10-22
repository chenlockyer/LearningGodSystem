/**
 * 调用云函数获取 AI 回复
 * @param {Array} messages 聊天消息数组 [{role: 'user', content: '你好'}]
 * @returns {Promise<string>} AI 回复内容
 */
function callAI(messages) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'callAI',
      data: { messages },
      success: res => {
        if (res.result && res.result.code === 0) {
          // DeepSeek 返回格式兼容
          const reply = res.result.data.choices && res.result.data.choices[0].message.content;
          resolve(reply || 'AI无回复');
        } else {
          reject(res.result.msg || '云函数调用失败');
        }
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

module.exports = {
  callAI
};
