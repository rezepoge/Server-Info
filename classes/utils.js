'use strict';

function msleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

function objectSum(object) {
    let sum = 0;

    for (let key in object) {
        sum += parseFloat(object[key]);
    }

    return parseFloat(sum);
}
module.exports = {
    msleep,
    objectSum,
}