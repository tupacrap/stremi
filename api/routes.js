import { getRouter } = require('stremio-addon-sdk');
import addonInterface from '../addon';

export default function handler(req, res) {
  const router = getRouter(addonInterface);
  router(req, res);
}
