const { decodeText } = require('./constants');

class PacketParser {
  static parseLPS(buffer, offset = 0) {
    const length = buffer.readUInt32LE(offset);
    const textBuffer = buffer.slice(offset + 4, offset + 4 + length);
    const text = decodeText(textBuffer);
    return {
      value: text,
      length: length + 4,
      nextOffset: offset + 4 + length
    };
  }

  static parseUL(buffer, offset = 0) {
    return {
      value: buffer.readUInt32LE(offset),
      length: 4,
      nextOffset: offset + 4
    };
  }

  static parseHelloAck(body) {
    return {
      pingPeriod: body.readUInt32LE(0)
    };
  }

  static parseUserStatus(body) {
    let offset = 0;

    const status = this.parseUL(body, offset);
    offset = status.nextOffset;

    const email = this.parseLPS(body, offset);

    return {
      status: status.value,
      email: email.value
    };
  }

  static parseContactList(body) {
    let offset = 0;

    const status = this.parseUL(body, offset);
    offset = status.nextOffset;

    const groupsNumber = this.parseUL(body, offset);
    offset = groupsNumber.nextOffset;

    const groupMask = this.parseLPS(body, offset);
    offset = groupMask.nextOffset;

    const contactsMask = this.parseLPS(body, offset);
    offset = contactsMask.nextOffset;

    const groups = [];
    for (let i = 0; i < groupsNumber.value; i++) {
      const group = this.parseGroup(body, offset, groupMask.value);
      offset = group.nextOffset;
      groups.push(group.data);
    }

    const contacts = [];
    while (offset < body.length) {
      const contact = this.parseContact(body, offset, contactsMask.value);
      offset = contact.nextOffset;
      contacts.push(contact.data);
    }

    return {
      status: status.value,
      groupsNumber: groupsNumber.value,
      groupMask: groupMask.value,
      contactsMask: contactsMask.value,
      groups: groups,
      contacts: contacts
    };
  }

  static parseGroup(buffer, offset, mask) {
    const group = {};
    let currentOffset = offset;

    for (const char of mask) {
      switch (char) {
        case 'u': 
          const ul = this.parseUL(buffer, currentOffset);
          currentOffset = ul.nextOffset;

          if (!group.flags) {
            group.flags = ul.value;
          }
          break;

        case 's': 
          const lps = this.parseLPS(buffer, currentOffset);
          currentOffset = lps.nextOffset;

          if (!group.name) {
            group.name = lps.value;
          }
          break;

        case 'z': 

          let zOffset = currentOffset;
          while (zOffset < buffer.length && buffer[zOffset] !== 0) {
            zOffset++;
          }
          currentOffset = zOffset + 1; 
          break;

        default:

          break;
      }
    }

    return {
      data: group,
      nextOffset: currentOffset
    };
  }

  static parseContact(buffer, offset, mask) {
    const contact = {};
    let currentOffset = offset;
    let fieldIndex = 0;

    for (const char of mask) {
      switch (char) {
        case 'u': 
          const ul = this.parseUL(buffer, currentOffset);
          currentOffset = ul.nextOffset;

          if (fieldIndex === 0) contact.flags = ul.value;        
          else if (fieldIndex === 1) contact.groupIndex = ul.value; 
          else if (fieldIndex === 4) contact.authFlags = ul.value;  
          else if (fieldIndex === 5) contact.status = ul.value;     

          fieldIndex++;
          break;

        case 's': 
          const lps = this.parseLPS(buffer, currentOffset);
          currentOffset = lps.nextOffset;

          if (fieldIndex === 2) contact.email = lps.value;       
          else if (fieldIndex === 3) contact.nickname = lps.value; 

          fieldIndex++;
          break;

        case 'z': 
          let zOffset = currentOffset;
          while (zOffset < buffer.length && buffer[zOffset] !== 0) {
            zOffset++;
          }
          currentOffset = zOffset + 1;
          fieldIndex++;
          break;

        default:

          break;
      }
    }

    return {
      data: contact,
      nextOffset: currentOffset
    };
  }

  static parseMessageAck(body) {
    let offset = 0;

    const msgId = this.parseUL(body, offset);
    offset = msgId.nextOffset;

    const flags = this.parseUL(body, offset);
    offset = flags.nextOffset;

    const from = this.parseLPS(body, offset);
    offset = from.nextOffset;

    const message = this.parseLPS(body, offset);
    offset = message.nextOffset;

    const rtf = this.parseLPS(body, offset);

    return {
      msgId: msgId.value,
      flags: flags.value,
      from: from.value,
      message: message.value,
      rtf: rtf.value
    };
  }

  static parseAddContactAck(body) {
    let offset = 0;

    const status = this.parseUL(body, offset);
    offset = status.nextOffset;

    const contactId = this.parseUL(body, offset);

    return {
      status: status.value,
      contactId: contactId.value
    };
  }

  static parseModifyContactAck(body) {
    let offset = 0;

    const status = this.parseUL(body, offset);

    return {
      status: status.value
    };
  }
}

module.exports = PacketParser;