const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('../addon');

const router = getRouter(addonInterface);

module.exports = (req, res) => {
    router(req, res, () => {
        res.statusCode = 404;
        res.end();
    });
};
