const storage = require('../../utils/storage.js');

Page({
  data: {
    attrsList: []
  },

  onShow() {
    this.loadAttrs();
  },

  loadAttrs() {
    const attrs = storage.getAttributes();
    const list = Object.keys(attrs).map(name => ({ name, level: attrs[name].level, exp: attrs[name].exp, progress: attrs[name].exp % 100 }));
    this.setData({ attrsList: list });
  }
});
