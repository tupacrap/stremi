const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('../addon');

module.exports = async (req, res) => {
    const router = getRouter(addonInterface);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    router(req, res, () => {
        res.status(404).end();
    });
};
