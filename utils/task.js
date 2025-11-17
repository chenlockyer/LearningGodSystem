/**
 * 任务相关API调用工具
 */

const API_BASE_URL = 'http://localhost:3000';

/**
 * 从聊天记录提取任务
 * @param {Array} messages 聊天消息数组
 * @returns {Promise<Array>} 提取的任务列表
 */
function extractTasksFromChat(messages) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}/api/extract-tasks`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        messages: messages
      },
      timeout: 30000,
      success: res => {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          resolve(res.data.data.tasks || []);
        } else {
          reject(new Error(res.data?.msg || '提取任务失败'));
        }
      },
      fail: err => {
        console.error('提取任务失败:', err);
        reject(new Error('无法连接到服务器，请检查后端服务是否启动'));
      }
    });
  });
}

/**
 * 根据每日战报更新任务进度
 * @param {string} dailyReport 每日战报内容
 * @param {Array} tasks 任务列表
 * @returns {Promise<Array>} 进度更新列表
 */
function updateTaskProgressByReport(dailyReport, tasks) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}/api/update-task-progress`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        dailyReport: dailyReport,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description || ''
        }))
      },
      timeout: 30000,
      success: res => {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          resolve(res.data.data.progressUpdates || []);
        } else {
          reject(new Error(res.data?.msg || '更新任务进度失败'));
        }
      },
      fail: err => {
        console.error('更新任务进度失败:', err);
        reject(new Error('无法连接到服务器，请检查后端服务是否启动'));
      }
    });
  });
}

module.exports = {
  extractTasksFromChat,
  updateTaskProgressByReport
};

