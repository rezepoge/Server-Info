const async = require('async');
const serverinfo = require('./serverinfo');
const settings = require('./settings').get();
const store = require('./store');

let wss = null;
const cpuLoadArchive = [];
const ramLoadArchive = [];
const containerLoadArchive = {};

let cpuDataCache = {};
let ramDataCache = {};
let hddDataCache = {};
let netLoadDataCache = {};
let containerDataCache = {};

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
    return {
        purpose: "initialData",
        cpuData: {
            percentage: cpuDataCache,
            sysload: serverinfo.getSysLoad(),
        },
        ramData: ramDataCache,
        hddData: hddDataCache,
        containerData: containerDataCache,
        netLoadData: netLoadDataCache,
        softVerData: serverinfo.getSoftwareVersions(),
        uptimeData: serverinfo.getUptime(),
        cpuLoadArchive: store.get('cpuLoadArchive'),
        ramLoadArchive: ramLoadArchive,
    };
}

function fetchCpuData() {
    const cpuData = serverinfo.getCpuData();
    cpuDataCache = cpuData;
    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateCpuData",
            data: {
                percentage: cpuData,
                sysload: serverinfo.getSysLoad()
            }
        }));
    });
    store.pushList('cpuLoadArchive', {
        y: parseFloat((100.0 - cpuData.idle).toFixed(3)),
        t: new Date()
    }, 360);
}

function fetchRamData() {
    const ramData = serverinfo.getRamData();
    ramDataCache = ramData;
    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateRamData",
            data: ramData,
        }));
    });
    ramLoadArchive.push({
        y: ramData.percent,
        t: new Date()
    });
    if (ramLoadArchive.length > 180) {
        ramLoadArchive.shift();
    }
}

function fetchHddData(params) {
    serverinfo.getHddData(params.paths[0]).then(hddData => {
        hddDataCache = hddData;
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

    containerDataCache = containerData;

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

    netLoadDataCache = netLoadData;

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateNetLoadData",
            data: netLoadData
        }));
    });
}

function fetchSoftwareVersionData() {
    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateSoftVerData",
            data: serverinfo.getSoftwareVersions(),
        }));
    });
}

function fetchUptimeData() {
    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateUptimeData",
            data: serverinfo.getUptime(),
        }));
    });
}