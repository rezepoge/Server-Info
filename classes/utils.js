'use strict';

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
module.exports = {
    msleep,
    objectSum,
}