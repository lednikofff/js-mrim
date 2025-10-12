const { CS_MAGIC, CS_PROTO } = require('./constants');

class MrimHeader {
  static SIZE = 44; 

  constructor() {
    this.magic = CS_MAGIC;
    this.proto = CS_PROTO;
    this.seq = 0;
    this.msg = 0;
    this.dlen = 0;
    this.fromHost = 0;
    this.fromPort = 0;
    this.reserved = Buffer.alloc(16);
  }

  static build(seq, msg, dlen = 0, fromHost = 0, fromPort = 0) {
    const buffer = Buffer.alloc(MrimHeader.SIZE);

    buffer.writeUInt32LE(CS_MAGIC, 0);
    buffer.writeUInt32LE(CS_PROTO, 4);
    buffer.writeUInt32LE(seq, 8);
    buffer.writeUInt32LE(msg, 12);
    buffer.writeUInt32LE(dlen, 16);
    buffer.writeUInt32LE(fromHost, 20);
    buffer.writeUInt32LE(fromPort, 24);
    buffer.fill(0, 28, 44); 

    return buffer;
  }

  static parse(buffer) {
    if (buffer.length < MrimHeader.SIZE) {
      throw new Error(`Header too small: ${buffer.length} bytes`);
    }

    return {
      magic: buffer.readUInt32LE(0),
      proto: buffer.readUInt32LE(4),
      seq: buffer.readUInt32LE(8),
      msg: buffer.readUInt32LE(12),
      dlen: buffer.readUInt32LE(16),
      fromHost: buffer.readUInt32LE(20),
      fromPort: buffer.readUInt32LE(24),
      reserved: buffer.slice(28, 44),
      body: buffer.slice(MrimHeader.SIZE)
    };
  }
}

module.exports = MrimHeader;