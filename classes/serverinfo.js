'use strict';
const diskspace = require('diskspace');
const os = require('os');
const shell = require('shelljs');
const fs = require('fs');
const fsp = require('fs').promises;
const utils = require('./utils');

function getCpuData() {
    const stat1 = fs.readFileSync('/proc/stat', 'utf8').split('\n');
    utils.msleep(1000);
    const stat2 = fs.readFileSync('/proc/stat', 'utf8').split('\n');

    const info1 = stat1[0].replace(/cpu +/gi, '').split(' ');
    const info2 = stat2[0].replace(/cpu +/gi, '').split(' ');

    const dif = {
        user: parseInt(info2[0]) - parseInt(info1[0]),
        nice: parseInt(info2[1]) - parseInt(info1[1]),
        sys: parseInt(info2[2]) - parseInt(info1[2]),
        idle: parseInt(info2[3]) - parseInt(info1[3])
    };
    const total = utils.objectSum(dif);

    const cpu = {
        user: null,
        nice: null,
        sys: null,
        idle: null
    };

    for (let x in dif) {
        cpu[x] = parseFloat((dif[x] / total * 100).toFixed(2));
    }

    return cpu;
}

function getRamData() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percent = parseFloat((usedMem / totalMem * 100).toFixed(2));

    return {
        total: utils.getByte(totalMem),
        free: utils.getByte(freeMem),
        used: utils.getByte(usedMem),
        percent: percent
    };
}

function getHddData() {
    return new Promise((resolve, reject) => {
        diskspace.check('/', function (err, result) {
            const totalMem = result.total;
            const freeMem = result.free;
            const usedMem = result.used;
            const percent = parseFloat((usedMem / totalMem * 100).toFixed(2));

            if(!err) {
                resolve({
                    total: utils.getByte(totalMem),
                    free: utils.getByte(freeMem),
                    used: utils.getByte(usedMem),
                    percent: percent
                });
            } else {
                reject(err);
            }
        });
    });
}

function getContainerStatus() {
    const baseStats = shell.exec('docker ps --all --format "{{.Names}}|{{.Image}}|{{.Status}}"', {
        silent: true
    }).stdout.split('\n');

    const resStats = shell.exec('docker stats --all --no-stream --format "{{.CPUPerc}}|{{.MemPerc}}"', {
        silent: true
    }).stdout.split('\n');

    const containers = [];

    for (let key in baseStats) {
        const baseStatsCols = baseStats[key].split('|');
        const resStatsCols = resStats[key].split('|');
        if (baseStatsCols.length == 3 && resStatsCols.length == 2) {
            containers.push({
                name: baseStatsCols[0],
                image: baseStatsCols[1],
                status: baseStatsCols[2],
                cpu: parseFloat(resStatsCols[0]),
                ram: parseFloat(resStatsCols[1])
            });
        }
    }

    containers.sort((a, b) => {
        if (a.name < b.name) {
            return -1;
        }
        if (a.name > b.name) {
            return 1;
        }
        return 0;
    });

    return {
        containers: containers
    };
}

function getNetworkLoad(netInt) {
    const basePath = '/opt/networkload/nload_';
    const timeSpans = ['hour', 'day', 'yesterday'];
    const netload_in = {};
    const netload_out = {};

    if (!fs.existsSync('/sys/class/net/' + netInt)) {
        res.json({
            error: 'Interface ' + netInt + ' does\'t exists',
        });
        return;
    }

    netload_in['total'] = fs.readFileSync('/sys/class/net/' + netInt + '/statistics/rx_bytes', 'utf8');
    netload_out['total'] = fs.readFileSync('/sys/class/net/' + netInt + '/statistics/tx_bytes', 'utf8');

    timeSpans.forEach(timeSpan => {
        const comparingTimeSpan = timeSpan == 'yesterday' ? 'tilltoday' : 'total';

        const netloadForTimeSpan = fs.readFileSync(basePath + timeSpan + '_' + netInt, 'utf8').split('\n');
        const netload_in_f = parseInt(netloadForTimeSpan[0]);
        const netload_out_f = parseInt(netloadForTimeSpan[1]);

        if (timeSpan == 'day') {
            netload_in['tilltoday'] = netload_in_f;
            netload_out['tilltoday'] = netload_out_f;
        }

        netload_in[timeSpan] = netload_in[comparingTimeSpan] - netload_in_f;
        netload_out[timeSpan] = netload_out[comparingTimeSpan] - netload_out_f;
    });

    let min = parseInt(new Date().getMinutes());
    min = min == 0 ? 1 : min;

    const avgload = utils.getByte(((netload_out['hour'] / min) / 60), 2) + '/Sek.';
    const minload_kbs = ((netload_out['hour'] / min) / 60) / 1024;

    const percentUsed = parseFloat((minload_kbs / (100 / 8 * 1024) * 100).toFixed(2));

    return {
        in: {
            total: utils.getByte(netload_in['total']),
            yesterday: utils.getByte(netload_in['yesterday']),
            today: utils.getByte(netload_in['day']),
            lasthour: utils.getByte(netload_in['hour']),
        },
        out: {
            total: utils.getByte(netload_out['total']),
            yesterday: utils.getByte(netload_out['yesterday']),
            today: utils.getByte(netload_out['day']),
            lasthour: utils.getByte(netload_out['hour']),
        },
        avgload: avgload,
        percent: percentUsed

    };
}

function getSoftwareVersions() {
    const debianVer = 'Debian ' + shell.cat('/etc/debian_version').trim();

    const apacheVer = shell.exec('/usr/sbin/apache2 -v', {
            silent: true
        }).stdout
        .match(/[0-9]+\.[0-9]+\.[0-9]+/)[0];

    const sslVer = shell.exec('openssl version', {
            silent: true
        }).stdout
        .match(/[0-9]+\.[0-9]+\.[0-9a-zA-z]+/)[0];

    const phpVer74 = shell.exec('/usr/local/php7.4/bin/php -v', {
            silent: true
        }).stdout
        .match(/[0-9]+\.[0-9]+\.[0-9]+/)[0];

    const phpVer73 = shell.exec('/usr/local/php7.3/bin/php -v', {
            silent: true
        }).stdout
        .match(/[0-9]+\.[0-9]+\.[0-9]+/)[0];

    const phpVer = `${phpVer74}, ${phpVer73}`;

    return {
        os: debianVer,
        apache: apacheVer,
        php: phpVer,
        openssl: sslVer,
    };
}

function getUptime() {
    const uptime = os.uptime();

    return {
        uptime: uptime,
        uptime_formated: utils.getTime(uptime)
    };
}

module.exports = {
    getCpuData,
    getSysLoad: os.loadavg,
    getRamData,
    getHddData,
    getContainerStatus,
    getNetworkLoad,
    getUptime,
    getSoftwareVersions,
}