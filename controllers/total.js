'use strict';

const Total = require('../services/total');
const version = require('../package.json').version;
const config = require('../config');
const getDownloadTotal = require('./utils').getDownloadTotal;
const cacheClient = require('../common/cache');
const logger = require('../common/logger');

const startTime = '' + Date.now();
let cache = null;

module.exports = function* showTotal() {
  if (cache && Date.now() - cache.cache_time < 120000) {
    // cache 120 seconds
    this.body = cache;
    return;
  }

  const cacheKey = 'registry_total';
  if (cacheClient) {
    const result = yield cacheClient.get(cacheKey);
    if (result) {
      this.body = JSON.parse(result);
      return;
    }
  }

  if (cache) {
    // set cache_time fisrt, avoid query in next time
    cache.cache_time = Date.now();
  }

  const r = yield [ Total.get(), getDownloadTotal() ];
  const total = r[0];
  const download = r[1];

  total.download = download;
  total.db_name = 'registry';
  total.instance_start_time = startTime;
  total.node_version = process.version;
  total.app_version = version;
  total.donate = 'https://www.gittip.com/fengmk2';
  total.sync_model = config.syncModel;

  cache = total;
  cache.cache_time = Date.now();

  this.body = total;
  if (cacheClient) {
    cacheClient.pipeline()
      .set(cacheKey, JSON.stringify(total))
      // cache 12h
      .expire(cacheKey, 3600 * 12)
      .exec()
      .catch(err => {
        logger.error(err);
      });
  }
};
