'use strict';

function getTime(seconds) {
    const td = {};
    td['total'] = seconds;
    td['sec'] = seconds % 60;
    td['min'] = ((seconds - td['sec']) / 60) % 60;
    td['std'] = ((((seconds - td['sec']) / 60) - td['min']) / 60) % 24;
    td['day'] = Math.floor((((((seconds - td['sec']) / 60) - td['min']) / 60) / 24));
    let timestring = '';
    if (td['day'] == 1) timestring += td['day'] + ' Tag ';
    else if (td['day'] > 1) timestring += td['day'] + ' Tage ';
    if (td['std'] == 1) timestring += td['std'] + ' Stunde ';
    else if (td['std'] > 1) timestring += td['std'] + ' Stunden ';
    if (td['min'] == 1) timestring += td['min'] + ' Minute ';
    else if (td['min'] > 1) timestring += td['min'] + ' Minuten ';
    return timestring;
}

function msleep(n) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

function objectSum(object) {
    let sum = 0;

    for (let key in object) {
        sum += parseFloat(object[key]);
    }

    return parseFloat(sum);
}

function getByte(bytes) {
    bytes = parseFloat(bytes);
    if (bytes < 0) {
        bytes = 0;
    }
    let symbol = ' Bytes';
    if (bytes > 1024) {
        symbol = ' KB';
        bytes /= 1024;
    }
    if (bytes > 1024) {
        symbol = ' MB';
        bytes /= 1024;
    }
    if (bytes > 1024) {
        symbol = ' GB';
        bytes /= 1024;
    }
    if (bytes > 1024) {
        symbol = ' TB';
        bytes /= 1024;
    }
    if (bytes > 1024) {
        symbol = ' PB';
        bytes /= 1024;
    }
    if (bytes > 1024) {
        symbol = ' EB';
        bytes /= 1024;
    }
    bytes = bytes.toFixed(2);
    return bytes + symbol;
}

module.exports = {
    getTime,
    msleep,
    objectSum,
    getByte
}