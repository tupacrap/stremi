const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('../addon');

const app = express();
const router = getRouter(addonInterface);

app.use((req, res) => router(req, res));

module.exports = app;
