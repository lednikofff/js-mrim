const MrimHeader = require('./Header');
const { encodeText } = require('./constants');

class PacketBuilder {
  constructor() {
    this.seq = 0;
  }

  nextSeq() {
    return ++this.seq;
  }

  createUL(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value, 0);
    return buffer;
  }

  createLPS(value) {
    const textBuffer = encodeText(value);
    const lengthBuffer = this.createUL(textBuffer.length);
    return Buffer.concat([lengthBuffer, textBuffer]);
  }

  buildHello() {
    return MrimHeader.build(this.nextSeq(), 0x1001, 0);
  }

  buildLogin2(email, password, status, userAgent) {
    const emailLPS = this.createLPS(email);
    const passwordLPS = this.createLPS(password);
    const statusUL = this.createUL(status);
    const userAgentLPS = this.createLPS(userAgent);

    const body = Buffer.concat([emailLPS, passwordLPS, statusUL, userAgentLPS]);

    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1038, body.length),
      body
    ]);
  }

  buildPing() {
    return MrimHeader.build(this.nextSeq(), 0x1006, 0);
  }

  buildMessage(to, message) {
    const flags = this.createUL(0); 
    const toLPS = this.createLPS(to);
    const messageLPS = this.createLPS(message);
    const rtfLPS = this.createLPS(' '); 

    const body = Buffer.concat([flags, toLPS, messageLPS, rtfLPS]);

    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1008, body.length),
      body
    ]);
  }

  buildMessageRecv(from, msgId) {
    const fromLPS = this.createLPS(from);
    const msgIdUL = this.createUL(msgId);

    const body = Buffer.concat([fromLPS, msgIdUL]);

    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1011, body.length),
      body
    ]);
  }
}

module.exports = PacketBuilder;