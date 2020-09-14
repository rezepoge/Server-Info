'use strict';

const Redis = require('redis');
const settings = require('./settings').get();
const baseKey = 'serverinfo_';

const redis = settings.redis ? Redis.createClient(settings.redis) : null;
const localStore = {};

if (redis) {
    console.info('using redis');
    redis.on("error", err => {
        console.error('Redis Error:', err);
    });
} else {
    console.info('redis not available');
}

module.exports = {
    set(key, value) {
        localStore[key] = value;
    },
    pushList(key, value, maxLength) {
        if (!Array.isArray(localStore[key])) {
            localStore[key] = [];
            if (redis) {
                redis.get(baseKey + key, (err, data) => {
                    console.debug('push', err, data);
                    if (!err) {
                        localStore[key] = JSON.parse(data);
                    }

                    localStore[key].push(value);

                    if (localStore[key].length > maxLength) {
                        localStore[key].shift();
                    }

                    redis.set(baseKey + key, JSON.stringify(localStore[key]));

                    return;
                });
            }
        }
        localStore[key].push(value);

        if (localStore[key].length > maxLength) {
            localStore[key].shift();
        }

        if (redis) {
            redis.set(baseKey + key, JSON.stringify(localStore[key]));
        }
    },
    get(key) {
        return localStore[key];
    }
}