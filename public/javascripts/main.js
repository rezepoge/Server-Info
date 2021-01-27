'use strict';

const serverinfo = new Serverinfo(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
    location.host + '/ws');

serverinfo.verbinden();

function Serverinfo(wsurl) {
    const _this = this;
    const cpuChartCanvas = document.getElementById('cpuChart_canvas');
    const ramChartCanvas = document.getElementById('ramChart_canvas');
    const chartOptionsSysload = {
        maintainAspectRatio: false,
        legend: {
            labels: false
        },
        scales: {
            yAxes: [{
                id: 'y-axis-1',
                position: 'left',
                ticks: {
                    stepSize: 25,
                    fontColor: '#FFF',
                    beginAtZero: true,
                    suggestedMin: 0,
                    suggestedMax: 100
                },
                gridLines: {
                    color: '#FFFFFF55'
                }
            },{
                id: 'y-axis-2',
                position: 'right',
                ticks: {
                    fontColor: '#FFF',
                    beginAtZero: true
                },
                gridLines: {
                    color: '#FFFFFF55'
                }
            }],
            xAxes: [{
                ticks: {
                    stepSize: 25,
                    fontColor: '#FFF',
                    source: 'auto'
                },
                gridLines: {
                    zeroLineColor: '#FFFFFF33',
                    color: '#FFFFFF33'
                },
                type: 'time',
                time: {
                    unit: 'minute',
                    stepSize: 1,
                    displayFormats: {
                        minute: 'HH:mm'
                    }
                }
            }]
        }
    };

    const chartOptionsRam = {
        maintainAspectRatio: false,
        legend: {
            labels: false
        },
        scales: {
            yAxes: [{
                ticks: {
                    stepSize: 25,
                    fontColor: '#FFF',
                    beginAtZero: true,
                    suggestedMin: 0,
                    suggestedMax: 100
                },
                gridLines: {
                    color: '#FFFFFF55'
                }
            }],
            xAxes: [{
                ticks: {
                    stepSize: 25,
                    fontColor: '#FFF',
                    source: 'auto'
                },
                gridLines: {
                    zeroLineColor: '#FFFFFF33',
                    color: '#FFFFFF33'
                },
                type: 'time',
                time: {
                    unit: 'minute',
                    stepSize: 1,
                    displayFormats: {
                        minute: 'HH:mm'
                    }
                }
            }]
        }
    };
    let cpuChart, ramChart;

    this.connection;

    this.verbinden = function () {
        _this.connection = new WebSocket(wsurl);

        _this.connection.onopen = function () {
            document.body.style.cursor = 'wait';

            _this.connection.send(JSON.stringify({
                purpose: 'init',
            }));

            document.body.style.cursor = 'default';
        };

        _this.connection.onmessage = function (msg) {
            let json = JSON.parse(msg.data);

            if (json.purpose) {
                switch (json.purpose) {
                    case 'initialData':
                        json.data.forEach(val => {
                            switch (val.type) {
                                case 'cpu':
                                    renderSysloadData(val.data, val.id);
                                    initCpuChart(val.archive);
                                    break;
                                case 'ram':
                                    renderRamData(val.data, val.id);
                                    initRamChart(val.archive);
                                    break;
                                case 'hdd':
                                    renderHddData(val.data, val.id);
                                    break;
                                case 'container':
                                    renderContainerData(val.data, val.id);
                                    break;
                                case 'network':
                                    renderNetworkData(val.data, val.id);
                                    break;
                                case 'software':
                                    renderSoftwareData(val.data, val.id);
                                    break;
                                case 'uptime':
                                    renderUptimeData(val.data, val.id);
                                    break;
                            }
                        });
                        break;
                    case 'updateCpuData':
                        renderSysloadData(json.data, json.id);
                        break;
                    case 'updateRamData':
                        renderRamData(json.data, json.id);
                        break;
                    case 'updateHddData':
                        renderHddData(json.data, json.id);
                        break;
                    case 'updateContainerData':
                        renderContainerData(json.data, json.id);
                        break;
                    case 'updateNetLoadData':
                        renderNetworkData(json.data, json.id);
                        break;
                    case 'updateSoftVerData':
                        renderSoftwareData(json.data, json.id);
                        break;
                    case 'updateUptimeData':
                        renderUptimeData(json.data, json.id);
                        break;
                }
            }
        };

        _this.connection.onerror = function (error) {
            console.error(error);
        };

        _this.connection.onclose = function (ev) {
            console.log(ev);
        };
    }

    function initCpuChart(data) {
        cpuChart = new Chart(cpuChartCanvas, {
            type: 'line',
            data: {
                datasets: [{
                    data: data.map(val => val.cpuLoad),
                    backgroundColor: '#bad13933',
                    borderColor: '#bad139',
                    borderWidth: 2,
                    lineTension: 0,
                    pointRadius: 0,
                    id: 'y-axis-1',
                },{
                    data: data.map(val => val.threads),
                    backgroundColor: '#bad13933',
                    borderColor: '#bad139',
                    borderWidth: 2,
                    lineTension: 0,
                    pointRadius: 0,
                    id: 'y-axis-2',
                }],
            },
            options: chartOptionsSysload
        });
    }

    function updateCpuChart(val, dataset) {
        if (cpuChart) {
            cpuChart.data.datasets[dataset].data.push({
                y: val,
                t: new Date()
            });

            while (cpuChart.data.datasets[dataset].data.length > 360) {
                cpuChart.data.datasets[dataset].data.shift();
            }

            cpuChart.update();
        }
    }

    function initRamChart(data) {
        ramChart = new Chart(ramChartCanvas, {
            type: 'line',
            data: {
                datasets: [{
                    data: data.map(val => val.percentUsed),
                    backgroundColor: '#bad13933',
                    borderColor: '#bad139',
                    borderWidth: 2,
                    lineTension: 0,
                    pointRadius: 0,
                }, {
                    data: data.map(val => val.percentNotFree),
                    backgroundColor: '#d1763933',
                    borderColor: '#d17639',
                    borderWidth: 2,
                    lineTension: 0,
                    pointRadius: 0,
                }],
            },
            options: chartOptionsRam
        });
    }

    function updateRamChart(val, dataset) {
        if (ramChart) {
            ramChart.data.datasets[dataset].data.push({
                y: val,
                t: new Date()
            });

            while (ramChart.data.datasets[dataset].data.length > 180) {
                ramChart.data.datasets[dataset].data.shift();
            }

            ramChart.update();
        }
    }

    function renderSysloadData(json, id) {
        if (!json || typeof id === 'undefined') return;

        const elem = document.querySelector(`#cpu_${id} .content`);
        elem.innerHTML =
            `<div id="sysload">
                <div class="sysloadVal">1 Min.: ${json.sysload[0].toFixed(2)}</div>
                <div class="sysloadVal">5 Min.: ${json.sysload[1].toFixed(2)}</div>
                <div class="sysloadVal">15 Min.: ${json.sysload[2].toFixed(2)}</div>
            </div>
            <div id="procStat">
                <div class="procStatVal">User: ${json.percentage.user.toFixed(1)}%</div>
                <div class="procStatVal">Nice: ${json.percentage.nice.toFixed(1)}%</div>
                <div class="procStatVal">System: ${json.percentage.sys.toFixed(1)}%</div>
                <div class="procStatVal">Idle: ${json.percentage.idle.toFixed(1)}%</div>
                <div class="procStatVal">I/O Wait: ${json.percentage.iowait.toFixed(1)}%</div>
            </div>`;

        const load = (100.0 - json.percentage.idle);
        updateCpuChart(load, json.threads);
    }

    function renderRamData(json, id) {
        if (!json || typeof id === 'undefined') return;

        const elem = document.querySelector(`#ram_${id} .content`);
        elem.innerHTML = `Gesammt: ${utils.getByte(json.total)} - Belegt: ${utils.getByte(json.used)} - Frei: ${utils.getByte(json.free)}`;

        updateRamChart(json.percentUsed, 0);
        updateRamChart(json.percentNotFree, 1);
    }

    function renderHddData(json, id) {
        if (!json || typeof id === 'undefined') return;

        const elem = document.querySelector(`#hdd_${id} .content`);
        elem.innerHTML = `Gesammt: ${utils.getByte(json.total)} - Belegt: ${utils.getByte(json.used)} - Frei: ${utils.getByte(json.free)}`;

        const hddLadebalkenElem = document.querySelector(`#hdd_${id} .ladebalken`);
        setCrircleChart(hddLadebalkenElem, json.percent);
    }

    function renderContainerData(json, id) {
        if (!json || typeof id === 'undefined') return;

        const elem = document.querySelector(`#container_${id} .content`);
        elem.clearChildren();

        json.containers.forEach(ctrData => {
            const cpuStatusClass = (
                ctrData.cpu > 100 ? 'overload' :
                ctrData.cpu > 67 ? 'critical' :
                ctrData.cpu > 50 ? 'high' :
                ctrData.cpu > 33 ? 'increased' : ''
            );

            const ramStatusClass = (
                ctrData.ram > 90 ? 'critical' :
                ctrData.ram > 80 ? 'high' :
                ctrData.ram > 67 ? 'increased' : ''
            );

            const container = document.createElement('div');
            container.className = 'container_entry ' + ctrData.status.split(' ')[0];
            container.innerHTML = `<p class="container_name">${ctrData.name}</p>
                        <p class="container_image">${ctrData.image}</p>
                        <p class="container_status">${ctrData.status}</p>
                        <div class="container_loadBar_outer" title="CPU: ${ctrData.cpu}">
                            <div class="container_loadBar_inner cpu ${cpuStatusClass}"
                                style="width:${ctrData.cpu > 100 ? 100 : ctrData.cpu}%" title="CPU: ${ctrData.cpu}%"></div>
                            <div class="container_loadBar_avg" style="left:${ctrData.cpuAvg > 100 ? 100 : ctrData.cpuAvg}%"></div>
                            <div class="container_loadBar_max" style="left:${ctrData.cpuMax > 100 ? 100 : ctrData.cpuMax}%"></div>
                        </div>
                        <div class="container_loadBar_outer" title="RAM: ${ctrData.ram}">
                            <div class="container_loadBar_inner ram ${ramStatusClass}"
                                style="width:${ctrData.ram > 100 ? 100 : ctrData.ram}%" title="RAM: ${ctrData.ram}%"></div>
                            <div class="container_loadBar_avg" style="left:${ctrData.ramAvg > 100 ? 100 : ctrData.ramAvg}%"></div>
                            <div class="container_loadBar_max" style="left:${ctrData.ramMax > 100 ? 100 : ctrData.ramMax}%"></div>
                        </div>`;

            elem.appendChild(container);
        });
    }

    function renderNetworkData(json, id) {
        if (!json || typeof id === 'undefined') return;

        const elem = document.querySelector(`#network_${id} .content`);
        elem.innerHTML = `<table>
            <tr><th></th><th>Gesammt</th><th>Gestern</th><th>Heute</th><th>Ltz. Stunde</th></tr>
            <tr><td><b>Eingehend</b></td><td>${utils.getByte(json.in.total)}</td><td>${utils.getByte(json.in.yesterday)}</td><td>${utils.getByte(json.in.today)}</td><td>${utils.getByte(json.in.lasthour)}</td></tr>
            <tr><td><b>Ausgehend</b></td><td>${utils.getByte(json.out.total)}</td><td>${utils.getByte(json.out.yesterday)}</td><td>${utils.getByte(json.out.today)}</td><td>${utils.getByte(json.out.lasthour)}</td></tr>
            </table><br/>Durchschn. Auslastung: ${utils.getByte(json.avgload)}/Sek. (${json.percent}% bei 100 Mbit/s)`;
    }

    function renderSoftwareData(json, id) {
        if (!json || typeof id === 'undefined') return;

        const elem = document.querySelector(`#software_${id} .content`);
        elem.innerHTML = json.map(val => `<div class="software_entry"><b>${val.name}</b>: ${val.val}</div>`).join('');
    }

    function renderUptimeData(json, id) {
        if (!json || typeof id === 'undefined') return;

        const elem = document.querySelector(`#uptime_${id} .content`);

        elem.innerHTML = utils.getTime(json.uptime);
    }

    function setCrircleChart(elem, percent) {
        const options = {
            percent: parseFloat(percent) || 0.0001,
            size: 160,
            lineWidth: 12,
            rotate: 0
        }

        const canvas = elem.getElementsByTagName('canvas')[0] || document.createElement('canvas');
        const span = elem.getElementsByTagName('span')[0] || document.createElement('span');
        span.textContent = options.percent.toFixed(2).replace('.', ',') + '%';

        if (typeof (G_vmlCanvasManager) !== 'undefined') {
            G_vmlCanvasManager.initElement(canvas);
        }

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = options.size;

        elem.appendChild(span);
        elem.appendChild(canvas);

        ctx.translate(options.size / 2, options.size / 2);
        ctx.rotate((-1 / 2 + options.rotate / 180) * Math.PI);

        const radius = (options.size - options.lineWidth) / 2;

        const drawCircle = function (color, lineWidth, percent) {
            percent = Math.min(Math.max(0, percent || 1), 1);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2 * percent, false);
            ctx.strokeStyle = color;
            ctx.lineCap = 'round';
            ctx.lineWidth = lineWidth
            ctx.stroke();
        };

        let color = 'green';

        if (percent > 90) {
            color = 'purple';
        } else if (percent > 80) {
            color = 'red';
        } else if (percent > 67) {
            color = 'orange';
        }

        drawCircle('#efefef66', options.lineWidth, 100 / 100);
        drawCircle(color, options.lineWidth + 1, options.percent / 100);
    }
}
const utils = {
    getByte(bytes) {
        if (!bytes || bytes < 0) {
            bytes = 0;
        };

        bytes = parseFloat(bytes);
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
    },
    getTime(total) {
        if (total < 60) {
            return 'Weniger als eine Minute';
        }

        const seconds = total % 60;
        const minutes = ((total - seconds) / 60) % 60;
        const hours = ((((total - seconds) / 60) - minutes) / 60) % 24;
        const days = Math.floor(((((total - seconds) / 60) - minutes) / 60) / 24) % 365;
        const years = Math.floor((((((total - seconds) / 60) - minutes) / 60) / 24) / 365);

        const timeStrArr = [];

        if (years == 1) timeStrArr.push(years + ' Jahr');
        else if (years > 1) timeStrArr.push(years + ' Jahre');

        if (days == 1) timeStrArr.push(days + ' Tag');
        else if (days > 1) timeStrArr.push(days + ' Tage');

        if (hours == 1) timeStrArr.push(hours + ' Stunde');
        else if (hours > 1) timeStrArr.push(hours + ' Stunden');

        if (minutes == 1) timeStrArr.push(minutes + ' Minute');
        else if (minutes > 1) timeStrArr.push(minutes + ' Minuten');

        const lastElemIndex = timeStrArr.length - 1;
        if (lastElemIndex > 0) {
            timeStrArr[lastElemIndex] = 'und ' + timeStrArr[lastElemIndex];
        }

        return timeStrArr.join(' ');
    }
}

if (typeof Element.prototype.clearChildren === 'undefined') {
    Object.defineProperty(Element.prototype, 'clearChildren', {
        configurable: true,
        enumerable: false,
        value: function () {
            while (this.firstChild) this.removeChild(this.lastChild);
        }
    });
}