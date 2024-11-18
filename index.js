const { serveHTTP, getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./addon');

module.exports = getRouter(addonInterface);
