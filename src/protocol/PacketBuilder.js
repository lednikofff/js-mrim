const MrimHeader = require('./Header');
const { encodeText } = require('./constants');

class PacketBuilder {
  constructor() {
    this.seq = 0;
  }

  nextSeq() {
    return ++this.seq;
  }

buildAuthorize(email) {
  const emailLPS = this.createLPS(email);

  return Buffer.concat([
    MrimHeader.build(this.nextSeq(), 0x1020, emailLPS.length),
    emailLPS
  ]);
}
  createUL(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value, 0);
    return buffer;
  }

  createLPS(value) {
    if (value === undefined || value === null) value = '';
    const textBuffer = encodeText(value);
    const lengthBuffer = this.createUL(textBuffer.length);
    return Buffer.concat([lengthBuffer, textBuffer]);
  }

  buildHello() {
    return MrimHeader.build(this.nextSeq(), 0x1001, 0);
  }

  buildLogin2(email, password, status, userAgent, lang = 'ru', clientDescription = 'Node.js MRIM Client') {
    const emailLPS = this.createLPS(email);
    const passwordLPS = this.createLPS(password);
    const statusUL = this.createUL(status);
    const userAgentLPS = this.createLPS(userAgent);
    const langLPS = this.createLPS(lang);
    const clientDescLPS = this.createLPS(clientDescription);

    const body = Buffer.concat([
      emailLPS, 
      passwordLPS, 
      statusUL, 
      userAgentLPS,
      langLPS,
      clientDescLPS
    ]);

    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1038, body.length),
      body
    ]);
  }

  buildPing() {
    return MrimHeader.build(this.nextSeq(), 0x1006, 0);
  }

  buildMessage(to, message, flags = 0) {
    const flagsUL = this.createUL(flags);
    const toLPS = this.createLPS(to);
    const messageLPS = this.createLPS(message);
    const rtfLPS = this.createLPS(' ');

    const body = Buffer.concat([flagsUL, toLPS, messageLPS, rtfLPS]);

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

  buildAddContact(flags, groupId, email, name, phones = '') {
    const flagsUL = this.createUL(flags);
    const groupIdUL = this.createUL(groupId);
    const emailLPS = this.createLPS(email);
    const nameLPS = this.createLPS(name);
    const phonesLPS = this.createLPS(phones);
    const authLPS = this.createLPS(''); 
    const actionsUL = this.createUL(0); 

    const body = Buffer.concat([
      flagsUL, 
      groupIdUL, 
      emailLPS, 
      nameLPS, 
      phonesLPS,
      authLPS,
      actionsUL
    ]);

    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1019, body.length),
      body
    ]);
  }

  buildAddGroup(groupName, groupsCount = 0) {
    const flags = 0x00000002 | (groupsCount << 24); 
    const flagsUL = this.createUL(flags);
    const groupIdUL = this.createUL(0); 
    const groupNameLPS = this.createLPS(groupName);
    const emptyLPS = this.createLPS(''); 
    const emptyLPS2 = this.createLPS(''); 
    const emptyLPS3 = this.createLPS(''); 
    const actionsUL = this.createUL(0); 

    const body = Buffer.concat([
      flagsUL, 
      groupIdUL, 
      groupNameLPS, 
      emptyLPS, 
      emptyLPS2,
      emptyLPS3,
      actionsUL
    ]);

    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1019, body.length),
      body
    ]);
  }

  buildModifyContact(contactId, flags, groupId, email, name, phones = '') {
    const contactIdUL = this.createUL(contactId);
    const flagsUL = this.createUL(flags);
    const groupIdUL = this.createUL(groupId);
    const emailLPS = this.createLPS(email);
    const nameLPS = this.createLPS(name);
    const phonesLPS = this.createLPS(phones);
    const actionsUL = this.createUL(0); 
    const body = Buffer.concat([
      contactIdUL, 
      flagsUL, 
      groupIdUL, 
      emailLPS, 
      nameLPS, 
      phonesLPS,
      actionsUL
    ]);
    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x101B, body.length),
      body
    ]);
  }
  buildModifyGroup(contactId, groupName, groupsCount = 0) {
    const flags = 0x00000002 | (contactId << 24); 
    const contactIdUL = this.createUL(contactId);
    const flagsUL = this.createUL(flags);
    const groupIdUL = this.createUL(0); 
    const groupNameLPS = this.createLPS(groupName);
    const nameLPS = this.createLPS(groupName); 
    const actionsUL = this.createUL(0); 
    const body = Buffer.concat([
      contactIdUL, 
      flagsUL, 
      groupIdUL, 
      groupNameLPS, 
      nameLPS,
      actionsUL
    ]);
    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x101B, body.length),
      body
    ]);
  }
  buildAuthorize(email) {
    const emailLPS = this.createLPS(email);
    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1020, emailLPS.length),
      emailLPS
    ]);
  }
  buildSearchContacts(searchParams) {
    let body = Buffer.alloc(0);
    for (const [field, value] of Object.entries(searchParams)) {
      const fieldUL = this.createUL(parseInt(field));
      const valueLPS = this.createLPS(value.toString());
      body = Buffer.concat([body, fieldUL, valueLPS]);
    }
    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1029, body.length),
      body
    ]);
  }
  buildChangeStatus(status, statusTitle = '', statusDesc = '') {
    const statusUL = this.createUL(status);
    const statusUriLPS = this.createLPS(''); 
    const statusTitleLPS = this.createLPS(statusTitle);
    const statusDescLPS = this.createLPS(statusDesc);
    const featuresUL = this.createUL(0x03FF); 
    const body = Buffer.concat([
      statusUL,
      statusUriLPS,
      statusTitleLPS,
      statusDescLPS,
      featuresUL
    ]);
    return Buffer.concat([
      MrimHeader.build(this.nextSeq(), 0x1022, body.length),
      body
    ]);
  }
}
module.exports = PacketBuilder;