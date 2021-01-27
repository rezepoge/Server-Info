'use strict';

const diskspace = require('diskspace');
const os = require('os');
const shell = require('shelljs');
const fs = require('fs');
const fsp = require('fs').promises;
const utils = require('./utils');
const store = require('./store');
const settings = require('./settings').get();
const CronJob = require('cron').CronJob;

const monitoredInterfaces = settings.monitoredValues
    .filter(val => val.type == 'network')
    .map(val => val.params.interface);
monitoredInterfaces.forEach(netInt => store.sync('hourly_' + netInt));
monitoredInterfaces.forEach(netInt => store.sync('daily_' + netInt));
monitoredInterfaces.forEach(netInt => store.sync('yesterday_' + netInt));

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
        idle: parseInt(info2[3]) - parseInt(info1[3]),
        iowait: parseInt(info2[4]) - parseInt(info1[4]),
        irq: parseInt(info2[5]) - parseInt(info1[5]),
        softirq: parseInt(info2[6]) - parseInt(info1[6])
    };
    const total = utils.objectSum(dif);

    const cpu = {
        user: null,
        nice: null,
        sys: null,
        idle: null,
        iowait: null,
        irq: null,
        softirq: null
    };

    for (let x in dif) {
        cpu[x] = parseFloat((dif[x] / total * 100).toFixed(2));
    }

    return cpu;
}

function getRamData() {
    const [
        total,
        used,
        free,
        shared,
        cache,
        avail
    ] = shell.exec('free -b | sed -e \'2!d\' | grep -oP [0-9]+', {
        silent: true
    }).stdout.split('\n', 6);

    const percentUsed = parseFloat((used / total * 100).toFixed(2));
    const percentNotFree = parseFloat(((total - free) / total * 100).toFixed(2));

    return {
        total: total,
        used,
        free,
        shared,
        cache,
        avail,
        percentUsed,
        percentNotFree
    };
}

function getHddData(path) {
    return new Promise((resolve, reject) => {
        diskspace.check(path, function (err, result) {
            const totalMem = result.total;
            const freeMem = result.free;
            const usedMem = result.used;
            const percent = parseFloat((usedMem / totalMem * 100).toFixed(2));

            if (!err) {
                resolve({
                    total: totalMem,
                    free: freeMem,
                    used: usedMem,
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
    const timeSpans = ['hourly', 'daily', 'yesterday'];
    const netload_in = {};
    const netload_out = {};

    if (!fs.existsSync('/sys/class/net/' + netInt)) {
        return {
            error: 'Interface ' + netInt + ' does\'t exists'
        };
    }

    netload_in['total'] = parseInt(
        fs.readFileSync('/sys/class/net/' + netInt + '/statistics/rx_bytes', 'utf8')
        .replace(/(\r\n|\n|\r)/gm, '')
    );
    netload_out['total'] = parseInt(
        fs.readFileSync('/sys/class/net/' + netInt + '/statistics/tx_bytes', 'utf8')
        .replace(/(\r\n|\n|\r)/gm, '')
    );

    timeSpans.forEach(timeSpan => {
        const netloadForTimeSpan = store.get(timeSpan + '_' + netInt) || 0;

        if (netloadForTimeSpan) {
            const comparingTimeSpan = timeSpan == 'yesterday' ? 'tilltoday' : 'total';

            const netloadForTimeSpanIn = parseInt(netloadForTimeSpan.in);
            const netloadForTimeSpanOut = parseInt(netloadForTimeSpan.out);

            if (timeSpan == 'daily') {
                netload_in['tilltoday'] = netloadForTimeSpanIn;
                netload_out['tilltoday'] = netloadForTimeSpanOut;
            }

            netload_in[timeSpan] = netload_in[comparingTimeSpan] - netloadForTimeSpanIn;
            netload_out[timeSpan] = netload_out[comparingTimeSpan] - netloadForTimeSpanOut;
        }
    });

    let min = parseInt(new Date().getMinutes());
    min = min == 0 ? 1 : min;

    const avgload = ((netload_out['hourly'] / min) / 60);
    const percentUsed = parseFloat(((avgload / 1024) / (100 / 8 * 1024) * 100).toFixed(2));

    return {
        in: {
            total: netload_in['total'],
            yesterday: netload_in['yesterday'],
            today: netload_in['daily'],
            lasthour: netload_in['hourly'],
        },
        out: {
            total: netload_out['total'],
            yesterday: netload_out['yesterday'],
            today: netload_out['daily'],
            lasthour: netload_out['hourly'],
        },
        avgload: avgload,
        percent: percentUsed

    };
}

function getSoftwareVersions(instructions) {
    const versions = [];

    try {
        instructions.forEach(val => {
            versions.push({
                name: val.name,
                val: shell.exec(val.cmd, {
                    silent: true
                }).stdout.replace(/(\r\n|\n|\r)/gm, '')
            })
        });
    } catch (ex) {
        console.error(ex);
    }

    return versions;
}

function getUptime() {
    const uptime = os.uptime();

    return {
        uptime: uptime
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

function persistTransferedDataByInterface(netInt, timeSpan) {
    const promises = [];

    promises.push(fsp.readFile('/sys/class/net/' + netInt + '/statistics/tx_bytes', 'utf8'));
    promises.push(fsp.readFile('/sys/class/net/' + netInt + '/statistics/rx_bytes', 'utf8'));

    Promise.all(promises).then(data => {
        if (timeSpan == 'daily') {
            store.setAndPersist('yesterday_' + netInt, store.get(timeSpan + '_' + netInt));
        }

        store.setAndPersist(timeSpan + '_' + netInt, {
            out: data[0].replace(/(\r\n|\n|\r)/gm, ''),
            in: data[1].replace(/(\r\n|\n|\r)/gm, '')
        });
    });
}

const hourlyNetworkLoadJob = new CronJob('0 0 * * * *', () => {
    console.log('hourlyNetworkLoadJob', new Date());
    monitoredInterfaces.forEach(netInt => persistTransferedDataByInterface(netInt, 'hourly'));
}, null, true, 'Europe/Berlin');

const dailyNetworkLoadJob = new CronJob('0 0 0 * * *', () => {
    console.log('dailyNetworkLoadJob', new Date());
    monitoredInterfaces.forEach(netInt => persistTransferedDataByInterface(netInt, 'daily'));
}, null, true, 'Europe/Berlin');