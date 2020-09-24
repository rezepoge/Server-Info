'use strict';

const cpuChartCanvas = document.getElementById('cpuChart_canvas');
const ramChartCanvas = document.getElementById('ramChart_canvas');

const chartOptions = {
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

const serverinfo = new Serverinfo(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
    location.host + '/ws');

serverinfo.verbinden();

function Serverinfo(wsurl) {
    const _this = this;

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
}

function initCpuChart(data) {
    cpuChart = new Chart(cpuChartCanvas, {
        type: 'line',
        data: {
            datasets: [{
                data: data,
                backgroundColor: '#77997755',
                borderColor: '#008000',
                borderWidth: 2,
                lineTension: 0,
                pointRadius: 0,
            }],
        },
        options: chartOptions
    });
}

function updateCpuChart(val) {
    if (cpuChart) {
        cpuChart.data.datasets[0].data.push({
            y: val,
            t: new Date()
        });
        while (cpuChart.data.datasets[0].data.length > 360) {
            cpuChart.data.datasets[0].data.shift();
        }
        cpuChart.update();
    }
}

function initRamChart(data) {
    ramChart = new Chart(ramChartCanvas, {
        type: 'line',
        data: {
            datasets: [{
                data: data,
                backgroundColor: '#77997755',
                borderColor: '#008000',
                borderWidth: 2,
                lineTension: 0,
                pointRadius: 0,
            }],
        },
        options: chartOptions
    });
}

function updateRamChart(val) {
    if (ramChart) {
        ramChart.data.datasets[0].data.push({
            y: val,
            t: new Date()
        });
        while (ramChart.data.datasets[0].data.length > 180) {
            ramChart.data.datasets[0].data.shift();
        }
        ramChart.update();
    }
}

function renderSysloadData(json, id) {
    if (!json) return;

    const elem = document.querySelector('#cpu_' + id + ' .content');

    elem.innerHTML = '1 Min.: ' + json.sysload[0].toFixed(2) + ' - 5 Min.: ' + json.sysload[1].toFixed(2) + ' - 15 Min.: ' + json.sysload[2].toFixed(2) + '<br>' +
        'Nutzer: ' + json.percentage.user + '% - Hintergrund: ' + json.percentage.nice + '% - System: ' + json.percentage.sys + '% - Leerlauf: ' + json.percentage.idle + '%';

    const load = (100.0 - json.percentage.idle);

    updateCpuChart(load);
}

function renderRamData(json, id) {
    if (!json) return;

    const elem = document.querySelector('#ram_' + id + ' .content');

    elem.innerHTML = 'Gesammt: ' + json.total + ' - Belegt: ' + json.used + ' - Frei: ' + json.free;

    updateRamChart(json.percent);
}

function renderHddData(json, id) {
    if (!json) return;

    const elem = document.querySelector('#hdd_' + id + ' .content');

    elem.innerHTML = 'Gesammt: ' + json.total + ' - Belegt: ' + json.used + ' - Frei: ' + json.free;

    const hddLadebalkenElem = document.querySelector('#hdd_' + id + ' .ladebalken');

    setCrircleChart(hddLadebalkenElem, json.percent);
}

function renderContainerData(json, id) {
    if (!json) return;

    const elem = document.querySelector('#container_' + id + ' .content');
    elem.clearChildren();

    for (let key in json.containers) {
        const containerData = json.containers[key];

        const container = document.createElement('div');
        container.className = 'container_entry ' + containerData.status.split(' ')[0];
        container.innerHTML = `<p class="container_name">${containerData.name}</p>
                    <p class="container_image">${containerData.image}</p>
                    <p class="container_status">${containerData.status}</p>
                    <div class="container_loadBar_outer" title="CPU: ${containerData.cpu}">
                        <div class="container_loadBar_inner cpu ` +
            (containerData.cpu > 100 ? 'overload' :
                containerData.cpu > 67 ? 'critical' :
                containerData.cpu > 50 ? 'high' :
                containerData.cpu > 33 ? 'increased' : '') +
            `" style="width:${containerData.cpu > 100 ? 100 : containerData.cpu}%" title="CPU: ${containerData.cpu}%"></div>
                        <div class="container_loadBar_avg" style="left:${containerData.cpuAvg > 100 ? 100 : containerData.cpuAvg}%"></div>
                        <div class="container_loadBar_max" style="left:${containerData.cpuMax > 100 ? 100 : containerData.cpuMax}%"></div>
                    </div>
                    <div class="container_loadBar_outer" title="RAM: ${containerData.ram}">
                        <div class="container_loadBar_inner ram ` +
            (containerData.ram > 90 ? 'critical' :
                containerData.ram > 80 ? 'high' :
                containerData.ram > 67 ? 'increased' : '') +
            `" style="width:${containerData.ram > 100 ? 100 : containerData.ram}%" title="RAM: ${containerData.ram}%"></div>
                        <div class="container_loadBar_avg" style="left:${containerData.ramAvg > 100 ? 100 : containerData.ramAvg}%"></div>
                        <div class="container_loadBar_max" style="left:${containerData.ramMax > 100 ? 100 : containerData.ramMax}%"></div>
                    </div>`;

        elem.appendChild(container);
    }
}

function renderNetworkData(json, id) {
    if (!json) return;
    if (!json.in || !json.out) return;

    const elem = document.querySelector('#network_' + id + ' .content');

    elem.innerHTML = '<table>' +
        '<tr><th></th><th>Gesammt</th><th>Gestern</th><th>Heute</th><th>Ltz. Stunde</th></tr>' +
        '<tr><td><b>Eingehend</b></td><td>' + json.in.total + '</td><td>' + json.in.yesterday + '</td><td>' + json.in.today + '</td><td>' + json.in.lasthour + '</td></tr>' +
        '<tr><td><b>Ausgehend</b></td><td>' + json.out.total + '</td><td>' + json.out.yesterday + '</td><td>' + json.out.today + '</td><td>' + json.out.lasthour + '</td></tr>' +
        '</table><br/>Durchschn. Auslastung: ' + json.avgload + ' (' + json.percent + '% bei 100 Mbit/s)';
}

function renderSoftwareData(json, id) {
    if (!json) return;

    const elem = document.querySelector('#software_' + id + ' .content');

    let html = '';

    json.forEach(val => {
        html += `<b>${val.name}</b>: ${val.val} ● `;
    });

    elem.innerHTML = html.slice(0, -3);;
}

function renderUptimeData(json, id) {
    if (!json) return;

    const elem = document.querySelector('#uptime_' + id + ' .content');

    elem.innerHTML = json.uptime_formated;
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

if (typeof Element.prototype.clearChildren === 'undefined') {
    Object.defineProperty(Element.prototype, 'clearChildren', {
        configurable: true,
        enumerable: false,
        value: function () {
            while (this.firstChild) this.removeChild(this.lastChild);
        }
    });
}