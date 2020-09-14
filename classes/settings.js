'use strict';
const fs = require('fs');

const settings = fs.existsSync('./settings.json') ?
    JSON.parse(fs.readFileSync('./settings.json').toString()) : fs.existsSync('./settings.default.json') ?
    JSON.parse(fs.readFileSync('./settings.default.json').toString()) : null;

module.exports = {
    get: () => settings
};