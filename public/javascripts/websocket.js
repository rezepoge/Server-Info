'use strict';

const chat = new Chat(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
    location.host + '/webSocket');

const verbindenBtn = document.getElementById('verbinden');
const sendenBtn = document.getElementById('senden');
const userNameInpt = document.getElementById('username');
const messageInpt = document.getElementById('message');
const encryptInpt = document.getElementById('encrypt');
const loginForm = document.getElementById('loginForm');
const sendeForm = document.getElementById('sendeForm');
const bytesToWriteElem = document.getElementById('bytesToWrite');

verbindenBtn.addEventListener('click', chat.verbinden);

loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
});

sendenBtn.addEventListener('click', chat.senden);
messageInpt.addEventListener("keyup", function (event) {
    if (event.keyCode === 13 && !event.shiftKey) {
        event.preventDefault();
        sendenBtn.click();
    }
});

sendeForm.addEventListener('submit', function (event) {
    event.preventDefault();
});

function Chat(wsurl) {
    const _this = this;
    let userName;
    let keys = {};
    let serverKeys = {};
    let userList = [];
    const messageBox = document.getElementById('messageBox');
    const verbindungsBereich = document.getElementById('verbindungsBereich');
    const usersBereich = document.getElementById("users");

    this.connection;

    this.verbinden = function () {
        userName = userNameInpt.value;
        if (userName && userName.length >= userNameInpt.getAttribute('minlength') &&
            userName.length <= userNameInpt.getAttribute('maxlength')) {

            messageBox.innerHTML = '';
            verbindungsBereich.parentNode.removeChild(verbindungsBereich);

            _this.connection = new WebSocket(wsurl);

            _this.connection.onopen = function () {
                document.body.style.cursor = 'wait';

                addToMessageBox({
                    text: 'Verbindung hergestellt',
                    zeit: new Date().getTime(),
                    user: {
                        username: 'system'
                    }
                });

                keys = genKeys();

                _this.connection.send(JSON.stringify({
                    purpose: 'login',
                    user: userName,
                    keys: {
                        public: keys.public,
                        shared: keys.shared
                    }
                }))

                document.body.style.cursor = 'default';
            };

            _this.connection.onmessage = function (msg) {
                console.log(msg.data);
                let json = JSON.parse(msg.data);

                if (json.purpose) {
                    switch (json.purpose) {
                        case 'msg': {
                            addToMessageBox(json);
                            break;
                        }
                        case 'userupdate': {
                            userList = json.list;
                            userUpdate(json.count, json.list);
                            break;
                        }
                        case 'loginfailed': {
                            addToMessageBox(json);
                            setTimeout(function () {
                                window.location.reload();
                            }, 2000);
                            break;
                        }
                        case 'loginok': {
                            messageInpt.removeAttribute('disabled');
                            sendenBtn.removeAttribute('disabled');
                            Notification.requestPermission();

                            serverKeys = json.keys;
                            delete json.keys;

                            addToMessageBox(json);

                            messageInpt.addEventListener('input', function () {
                                let bytesToWrite = parseInt(messageInpt.getAttribute('maxlength'));
                                bytesToWrite -= messageInpt.value.length;
                                bytesToWriteElem.innerHTML = bytesToWrite;
                            });
                            break;
                        }
                    }
                }
            };

            _this.connection.onerror = function (error) {
                console.error(error);
                addToMessageBox({
                    text: 'Ein Fehler ist aufgetreten',
                    zeit: new Date().getTime(),
                    user: {
                        username: 'system'
                    }
                });
            };

            _this.connection.onclose = function (ev) {
                console.log(ev);
                addToMessageBox({
                    text: 'Verbindung wurde unterbrochen',
                    zeit: new Date().getTime(),
                    user: {
                        username: 'system'
                    }
                });
            };
        } else {
            addToMessageBox({
                text: 'Bitte gültigen Nutzernamen eingeben',
                zeit: new Date().getTime(),
                user: {
                    username: 'system'
                }
            });
        }
    }

    this.senden = function () {
        const message = messageInpt.value;
        const encryptMsg = encryptInpt.checked;

        console.log(encryptMsg);

        if (_this.connection && message.length >= messageInpt.getAttribute('minlength') && message.length <= messageInpt.getAttribute('maxlength')) {
            _this.connection.send(JSON.stringify({
                purpose: 'sendmsg',
                msg: (encryptMsg ? encrypt(message.trim(), serverKeys.public, serverKeys.shared) : message.trim())
            }));

            addToMessageBox({
                purpose: 'msg',
                text: message.trim(),
                zeit: new Date().toISOString(),
                user: {
                    username: userName
                }
            })

            messageInpt.value = '';
            bytesToWriteElem.innerHTML = messageInpt.getAttribute('maxlength');
        } else if (!_this.connection) {
            alert('Bitte zuerst "Verbinden"!');
        }
    }

    function userUpdate(count, list) {
        usersBereich.innerHTML = `Aktive Nutzer: ${list.map(item => item.name).join(', ')} (${count})`;
    }

    function addToMessageBox(msg) {
        document.body.style.cursor = 'wait';
        const receiveDate = new Date();
        const msgDate = new Date(msg.zeit);
        const scope = msg.user.username == userName ? 'self' : msg.user.username == 'server' || msg.user.username == 'system' ? 'system' : 'other';
        const messageElem = document.createElement('div');

        messageElem.className = `msg ${scope}`;
        messageElem.setAttribute('msgorder', msgDate.toISOString() + (typeof msg.id !== "undefined" ? msg.id : '0'));
        messageElem.setAttribute('msgid', typeof msg.id !== "undefined" ? msg.id : '0');

        if (scope !== 'system') {
            let datum = msgDate.toLocaleDateString('de-de', {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric"
            });
            let zeit = msgDate.toLocaleTimeString('de-de', {
                hour: "numeric",
                minute: "numeric"
            });

            let message = msg.text;
            let encrypted = false;

            if (scope === 'other' && typeof message === 'object') {
                message = decrypt(message, keys.private, keys.shared);
                encrypted = true;
            }

            messageElem.style.borderLeft = `5px solid #${userList.find(item => item.name == msg.user.username).color}`;

            messageElem.innerHTML = `<div class="header">
                <div class="user">${msg.user.username}</div>` +
                (encrypted ? '<div class="encrypted" title="Diese Nachricht wurde verschlüsselt übertragen">v</div>' : '') +
                `<div class="zeit" title="${datum}">${zeit}</div></div>
            <div class="text">${message.replace(/\n/g, '<br>')}</div>`;
        } else {
            messageElem.innerHTML = `<div class="text">${msg.text.replace(/\n/g, '<br>')}</div>`;
        }

        if (Notification.permission === 'granted' &&
            ((receiveDate.getTime() - msgDate.getTime()) < 10000) &&
            msg.user.username !== userName &&
            msg.user.username !== 'system') {

            if (scope !== 'system') {
                new Notification("Neue Nachricht von " + msg.user.username + ":", {
                    body: msg.text.substring(0, 32) + (msg.text.length > 32 ? '...' : '')
                });
            } else {
                new Notification(msg.text);
            }
        }

        if (typeof msg.mode !== "undefined") {
            messageBox.prepend(messageElem);
        } else {
            messageBox.append(messageElem);
        }

        if (!msg.mode || msg.mode != 2) {
            messageBox.scrollTop = messageBox.scrollHeight;
        }
        document.body.style.cursor = 'default';
    }
}