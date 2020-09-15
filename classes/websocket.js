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

        settings.monitoredValues.forEach(val => {
            monitorableValues[val.name](val.params);
            setInterval(() => {
                monitorableValues[val.name](val.params);
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
        purpose: "initialData"
    }

    settings.monitoredValues.forEach(val => {
        initialData[val.name] = store.get(val.name);
        if (val.name == 'cpu' || val.name == 'ram') {
            initialData[val.name + 'Archive'] = store.get(val.name + 'Archive');
        }
    });

    return initialData;
}

function fetchCpuData() {
    const cpuData = {
        percentage: serverinfo.getCpuData(),
        sysload: serverinfo.getSysLoad(),
    };

    store.set('cpu', cpuData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateCpuData",
            data: cpuData
        }));
    });

    store.pushToPersistentList('cpuArchive', {
        y: parseFloat((100.0 - cpuData.percentage.idle).toFixed(3)),
        t: new Date()
    }, 360);
}

function fetchRamData() {
    const ramData = serverinfo.getRamData();

    store.set('ram', ramData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateRamData",
            data: ramData,
        }));
    });

    store.pushToPersistentList('ramArchive', {
        y: ramData.percent,
        t: new Date()
    }, 180);
}

function fetchHddData(params) {
    serverinfo.getHddData(params.paths[0]).then(hddData => {
        store.set('hdd', hddData);

        async.forEach(wss.clients, sock => {
            sock.send(JSON.stringify({
                purpose: "updateHddData",
                data: hddData
            }));
        });
    });
}

function fetchContainerData() {
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
    store.set('hdd', containerData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateContainerData",
            data: containerData,
        }));
    });
}

function fetchNetworkLoadData(params) {
    const netLoadData = {};

    params.interfaces.forEach(interface => {
        netLoadData[interface] = serverinfo.getNetworkLoad(interface);
    });

    store.set('network', netLoadData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateNetLoadData",
            data: netLoadData
        }));
    });
}

function fetchSoftwareVersionData() {
    const softwareData = serverinfo.getSoftwareVersions();

    store.set('software', softwareData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateSoftVerData",
            data: softwareData,
        }));
    });
}

function fetchUptimeData() {
    const uptimeData = serverinfo.getUptime();

    store.set('uptime', uptimeData);

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateUptimeData",
            data: uptimeData,
        }));
    });
}