const app = getApp();
const storage = require('../../utils/storage.js');

Page({
    data: {
        inputContent: '',
        isGenerating: false,
        currentReport: null,
        historyReports: [],
        showHistory: false
    },

    onShow() {
        this.loadHistory();
    },

    loadHistory() {
        const reports = storage.getReports();
        const formattedReports = reports.map(report => {
            const date = new Date(report.createdAt);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            const weekDay = weekDays[date.getDay()];

            return {
                ...report,
                formattedDate: `${dateStr} ${weekDay}`
            };
        });

        this.setData({
            historyReports: formattedReports
        });
    },

    onInputChange(e) {
        this.setData({
            inputContent: e.detail.value
        });
    },

    toggleHistory() {
        this.setData({
            showHistory: !this.data.showHistory
        });
    },

    viewHistoryReport(e) {
        const index = e.currentTarget.dataset.index;
        const report = this.data.historyReports[index];
        this.setData({
            currentReport: report,
            showHistory: false
        });
    },

    onShowInput() {
        this.setData({
            currentReport: null
        });
    },

    async generateReport() {
        const content = this.data.inputContent.trim();
        if (!content) {
            wx.showToast({
                title: '请输入今日工作内容',
                icon: 'none'
            });
            return;
        }

        this.setData({ isGenerating: true });

        try {
            const userAttributes = storage.getAttributes();

            const res = await new Promise((resolve, reject) => {
                wx.request({
                    url: 'http://8.163.51.135:3000/api/daily-report',
                    method: 'POST',
                    data: {
                        content,
                        userAttributes
                    },
                    success: resolve,
                    fail: reject
                });
            });

            if (res.statusCode !== 200 || res.data.code !== 0) {
                throw new Error(res.data.msg || '生成失败');
            }

            const reportData = res.data.data;

            // 保存战报
            const savedReport = storage.saveReport({
                content,
                aiResponse: reportData
            });

            // 更新属性
            if (reportData.attributeChanges && reportData.attributeChanges.length > 0) {
                reportData.attributeChanges.forEach(change => {
                    storage.addExp(change.name, change.addExp);
                });

                wx.showToast({
                    title: '属性已更新！',
                    icon: 'success'
                });
            }

            this.setData({
                currentReport: savedReport,
                inputContent: '', // 清空输入
                isGenerating: false
            });

            // 刷新历史
            this.loadHistory();

        } catch (err) {
            console.error('生成战报失败', err);
            wx.showToast({
                title: '生成失败，请重试',
                icon: 'none'
            });
            this.setData({ isGenerating: false });
        }
    }
});
