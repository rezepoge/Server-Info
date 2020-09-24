const async = require('async');
const serverinfo = require('./serverinfo');
const settings = require('./settings').get();
const store = require('./store');

let wss = null;

const monitorableValues = {
    'cpu': fetchCpuData,
    'ram': fetchRamData,
    'hdd': fetchHddData,
    'container': fetchContainerData,
    'network': fetchNetworkLoadData,
    'software': fetchSoftwareVersionData,
    'uptime': fetchUptimeData
}

module.exports = {
    init(_wss) {
        wss = _wss;

        settings.monitoredValues.forEach((val, key) => {
            monitorableValues[val.type](key, val.params);
            setInterval(() => {
                monitorableValues[val.type](key, val.params);
            }, val.interval);
        });
    },
    connect(ws) {
        ws.on('message', message => {
            console.debug('WEBSOCKET', message);

            try {
                const msgJson = JSON.parse(message);

                switch (msgJson.purpose) {
                    case 'init':
                        ws.send(JSON.stringify(getInitialData()));
                        break;
                }
            } catch (err) {
                console.log(err);
            }
        });
        ws.on('close', (reason) => {
            console.log('WEBSOCKET [CLOSE] Status code:', reason);
        });
    }
}

function getInitialData() {
    const initialData = {
        purpose: "initialData",
        data: []
    }

    settings.monitoredValues.forEach((val, key) => {
        const data = {
            data: store.get(val.type + '_' + key),
            id: key,
            type: val.type
        };

        if (val.type == 'cpu' || val.type == 'ram') {
            data['archive'] = store.get(val.type + 'Archive');
        }

        initialData.data.push(data);
    });

    return initialData;
}

function fetchCpuData(key) {
    const cpuData = {
        percentage: serverinfo.getCpuData(),
        sysload: serverinfo.getSysLoad(),
    };

    store.set('cpu_' + key, cpuData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateCpuData",
            id: key,
            data: cpuData
        }));
    });

    store.pushToPersistentList('cpuArchive', {
        y: parseFloat((100.0 - cpuData.percentage.idle).toFixed(3)),
        t: new Date()
    }, 360);
}

function fetchRamData(key) {
    const ramData = serverinfo.getRamData();

    store.set('ram_' + key, ramData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateRamData",
            id: key,
            data: ramData,
        }));
    });

    store.pushToPersistentList('ramArchive', {
        y: ramData.percent,
        t: new Date()
    }, 180);
}

function fetchHddData(key, params) {
    serverinfo.getHddData(params.path).then(hddData => {
        store.set('hdd_' + key, hddData);

        async.forEach(wss.clients, sock => {
            sock.send(JSON.stringify({
                purpose: "updateHddData",
                id: key,
                data: hddData
            }));
        });
    });
}

function fetchContainerData(key) {
    const containerData = serverinfo.getContainerStatus();
    const containerLoadArchive = store.get('containerArchive') || {};

    containerData.containers.forEach(elem => {
        if (!containerLoadArchive[elem.name]) {
            containerLoadArchive[elem.name] = {
                cpu: [],
                ram: []
            };
        }

        containerLoadArchive[elem.name].cpu.push(elem.cpu);
        containerLoadArchive[elem.name].ram.push(elem.ram);

        if (containerLoadArchive[elem.name].cpu.length > 60) {
            containerLoadArchive[elem.name].cpu.shift();
            containerLoadArchive[elem.name].ram.shift();
        }

        elem.cpuAvg = containerLoadArchive[elem.name].cpu
            .reduce((p, c) => p + c, 0) / containerLoadArchive[elem.name].cpu.length;
        elem.ramAvg = containerLoadArchive[elem.name].ram
            .reduce((p, c) => p + c, 0) / containerLoadArchive[elem.name].ram.length;

        elem.cpuMax = Math.max.apply(null, containerLoadArchive[elem.name].cpu);
        elem.ramMax = Math.max.apply(null, containerLoadArchive[elem.name].ram);
    });

    store.set('containerArchive', containerLoadArchive);
    store.set('container_' + key, containerData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateContainerData",
            id: key,
            data: containerData,
        }));
    });
}

function fetchNetworkLoadData(key, params) {
    const netLoadData = serverinfo.getNetworkLoad(params.interface);

    store.set('network_' + key, netLoadData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateNetLoadData",
            id: key,
            data: netLoadData
        }));
    });
}

function fetchSoftwareVersionData(key, params) {
    const softwareData = serverinfo.getSoftwareVersions(params.instructions);

    store.set('software_' + key, softwareData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateSoftVerData",
            id: key,
            data: softwareData,
        }));
    });
}

function fetchUptimeData(key) {
    const uptimeData = serverinfo.getUptime();

    store.set('uptime_' + key, uptimeData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateUptimeData",
            id: key,
            data: uptimeData,
        }));
    });
}