const async = require('async');
const serverinfo = require('./serverinfo');

let wss = null;
const cpuLoadArchive = [];
const ramLoadArchive = [];
const containerLoadArchive = {};

let cpuDataCache = {};
let ramDataCache = {};
let hddDataCache = {};
let netLoadDataCache = {};
let containerDataCache = {};

module.exports = {
    init(_wss) {
        wss = _wss;

        fetchCpuData();
        setInterval(() => {
            fetchCpuData();
        }, 5000);

        fetchRamData();
        setInterval(() => {
            fetchRamData();
        }, 10000);

        fetchHddData();
        setInterval(() => {
            fetchHddData();
        }, 45000);

        fetchContainerData();
        setInterval(() => {
            fetchContainerData();
        }, 30000);

        fetchNetworkLoadData();
        setInterval(() => {
            fetchNetworkLoadData();
        }, 15000);

        fetchSoftwareVersionData();
        setInterval(() => {
            fetchSoftwareVersionData();
        }, 60000);

        fetchUptimeData();
        setInterval(() => {
            fetchUptimeData();
        }, 60000);
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
        cpuLoadArchive: cpuLoadArchive,
        ramLoadArchive: ramLoadArchive,
    }
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
    cpuLoadArchive.push({
        y: 100.0 - cpuData.idle,
        t: new Date()
    });
    if (cpuLoadArchive.length > 360) {
        cpuLoadArchive.shift();
    }
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

function fetchHddData() {
    serverinfo.getHddData().then(hddData => {
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

        if (containerLoadArchive[elem.name].cpu.length > 180) {
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

function fetchNetworkLoadData() {
    const netLoadData = {
        eth0: serverinfo.getNetworkLoad('eth0'),
        tun0: serverinfo.getNetworkLoad('tun0'),
    };

    netLoadDataCache = netLoadData;

    async.forEach(wss.clients, sock => {
        sock.send(JSON.stringify({
            purpose: "updateSoftwareVersionsData",
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