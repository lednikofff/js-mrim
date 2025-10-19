const net = require('net');
const EventEmitter = require('events');
const MrimHeader = require('../protocol/Header');

class MrimConnection extends EventEmitter {
    constructor() {
        super();
        this.socket = null;
        this.isConnected = false;
        this.buffer = Buffer.alloc(0);
    }

    async connect(host, port) {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection(port, host);

            this.socket.on('connect', () => {
                this.isConnected = true;
                this.emit('connected');
                resolve();
            });

            this.socket.on('data', (data) => this.handleData(data));
            this.socket.on('error', (error) => this.emit('error', error));
            this.socket.on('close', () => {
                this.isConnected = false;
                this.emit('disconnected');
            });

            this.socket.on('timeout', () => {
                this.emit('error', new Error('Connection timeout'));
            });
        });
    }

    handleData(data) {

        this.buffer = Buffer.concat([this.buffer, data]);

        while (this.buffer.length >= MrimHeader.SIZE) {
            try {
                const header = MrimHeader.parse(this.buffer);

                if (this.buffer.length >= MrimHeader.SIZE + header.dlen) {
                    const packet = this.buffer.slice(0, MrimHeader.SIZE + header.dlen);
                    this.buffer = this.buffer.slice(MrimHeader.SIZE + header.dlen);

                    this.emit('packet', header, packet);
                } else {

                    break;
                }
            } catch (error) {
                this.emit('error', error);
                break;
            }
        }
    }

    send(data) {
        if (this.isConnected && this.socket) {
            this.socket.write(data);
        } else {
            throw new Error('Not connected');
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.destroy();
        }
    }
}

module.exports = MrimConnection;