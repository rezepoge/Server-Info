'use strict';

const { check } = require('diskspace');
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
    setAndPersist(key, value) {
        localStore[key] = value;
        persistKey(key);
    },
    pushToPersistentList(key, value, maxLength) {
        if (!Array.isArray(localStore[key])) {
            localStore[key] = [];
            if (redis) {
                redis.get(baseKey + key, (err, data) => {
                    if (!err && data) {
                        localStore[key] = JSON.parse(data);
                    }

                    localStore[key].push(value);

                    checkMaxLength(key, maxLength);
                    persistKey(key);

                    return;
                });
            }
        }
        localStore[key].push(value);

        checkMaxLength(key, maxLength);
        persistKey(key);
    },
    get(key) {
        return localStore[key];
    },
    sync(key) {
        if (redis) {
            redis.get(baseKey + key, (err, data) => {
                if (!err && data) {
                    localStore[key] = JSON.parse(data);
                }
            });
        }
    }
}

function checkMaxLength(key, maxLength) {
    if (localStore[key].length > maxLength) {
        localStore[key].shift();
    }
}

function persistKey(key) {
    if (redis) {
        redis.set(baseKey + key, JSON.stringify(localStore[key]));
    }
}