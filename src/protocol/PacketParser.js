const {
    decodeText
} = require('./constants');

class PacketParser {
    static parseLPS(buffer, offset = 0) {
        if (offset + 4 > buffer.length) {
            throw new Error('Buffer too short for LPS');
        }

        const length = buffer.readUInt32LE(offset);

        if (offset + 4 + length > buffer.length) {
            throw new Error('Buffer too short for LPS data');
        }

        const textBuffer = buffer.slice(offset + 4, offset + 4 + length);
        const text = decodeText(textBuffer);

        return {
            value: text,
            length: length + 4,
            nextOffset: offset + 4 + length
        };
    }

    static parseUL(buffer, offset = 0) {
        if (offset + 4 > buffer.length) {
            throw new Error('Buffer too short for UL');
        }

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

    static parseLoginAck(body) {

        return {};
    }

    static parseLoginRej(body) {
        const reason = this.parseLPS(body, 0);
        return {
            reason: reason.value
        };
    }

    static parseUserStatus(body) {
        let offset = 0;

        const status = this.parseUL(body, offset);
        offset = status.nextOffset;

        let statusUri;
        try {
            statusUri = this.parseLPS(body, offset);
            offset = statusUri.nextOffset;
        } catch (e) {
            statusUri = {
                value: ''
            };

            offset += 4;
        }

        let statusTitle;
        try {
            statusTitle = this.parseLPS(body, offset);
            offset = statusTitle.nextOffset;
        } catch (e) {
            statusTitle = {
                value: ''
            };
            offset += 4;
        }

        let statusDesc;
        try {
            statusDesc = this.parseLPS(body, offset);
            offset = statusDesc.nextOffset;
        } catch (e) {
            statusDesc = {
                value: ''
            };
            offset += 4;
        }

        let email;
        try {
            email = this.parseLPS(body, offset);
            offset = email.nextOffset;
        } catch (e) {
            email = {
                value: ''
            };
            offset += 4;
        }

        let features;
        try {
            features = this.parseUL(body, offset);
            offset = features.nextOffset;
        } catch (e) {
            features = {
                value: 0
            };
            offset += 4;
        }

        let userAgent;
        try {
            userAgent = this.parseLPS(body, offset);

        } catch (e) {
            userAgent = {
                value: ''
            };
        }

        return {
            status: status.value,
            statusUri: statusUri.value,
            statusTitle: statusTitle.value,
            statusDesc: statusDesc.value,
            email: email.value,
            features: features.value,
            userAgent: userAgent.value
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
            try {
                const group = this.parseGroup(body, offset, groupMask.value);
                offset = group.nextOffset;
                groups.push(group.data);
            } catch (error) {
                console.error('Error parsing group:', error);
                break;
            }
        }

        const contacts = [];
        while (offset < body.length) {
            try {
                const contact = this.parseContact(body, offset, contactsMask.value);
                offset = contact.nextOffset;
                contacts.push(contact.data);
            } catch (error) {
                console.error('Error parsing contact:', error);
                break;
            }
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
            try {
                switch (char) {
                    case 'u':
                        const ul = this.parseUL(buffer, currentOffset);
                        currentOffset = ul.nextOffset;
                        group.flags = ul.value;
                        break;

                    case 's':
                        const lps = this.parseLPS(buffer, currentOffset);
                        currentOffset = lps.nextOffset;
                        group.name = lps.value;
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
            } catch (error) {
                console.error(`Error parsing group field '${char}':`, error);
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
            try {
                switch (char) {
                    case 'u':
                        const ul = this.parseUL(buffer, currentOffset);
                        currentOffset = ul.nextOffset;

                        if (fieldIndex === 0) contact.flags = ul.value;
                        else if (fieldIndex === 1) contact.groupId = ul.value;
                        else if (fieldIndex === 4) contact.serverFlags = ul.value;
                        else if (fieldIndex === 5) contact.status = ul.value;
                        else if (fieldIndex === 10) contact.features = ul.value;

                        fieldIndex++;
                        break;

                    case 's':
                        const lps = this.parseLPS(buffer, currentOffset);
                        currentOffset = lps.nextOffset;

                        if (fieldIndex === 2) contact.email = lps.value;
                        else if (fieldIndex === 3) contact.nickname = lps.value;
                        else if (fieldIndex === 6) contact.phones = lps.value;
                        else if (fieldIndex === 7) contact.statusUri = lps.value;
                        else if (fieldIndex === 8) contact.statusTitle = lps.value;
                        else if (fieldIndex === 9) contact.statusDesc = lps.value;
                        else if (fieldIndex === 11) contact.userAgent = lps.value;

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
            } catch (error) {
                console.error(`Error parsing contact field '${char}':`, error);
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

    static parseSearchResults(body) {
        let offset = 0;

        const status = this.parseUL(body, offset);
        offset = status.nextOffset;

        const fieldsNum = this.parseUL(body, offset);
        offset = fieldsNum.nextOffset;

        const maxRows = this.parseUL(body, offset);
        offset = maxRows.nextOffset;

        const serverTime = this.parseUL(body, offset);
        offset = serverTime.nextOffset;

        const fields = [];
        for (let i = 0; i < fieldsNum.value; i++) {
            try {
                const field = this.parseLPS(body, offset);
                offset = field.nextOffset;
                fields.push(field.value);
            } catch (error) {
                console.error('Error parsing search field:', error);
                break;
            }
        }

        const users = [];
        while (offset < body.length) {
            try {
                const user = {};
                for (let i = 0; i < fieldsNum.value; i++) {
                    if (offset >= body.length) break;

                    const value = this.parseLPS(body, offset);
                    offset = value.nextOffset;
                    user[fields[i]] = value.value;
                }
                if (Object.keys(user).length > 0) {
                    users.push(user);
                }
            } catch (error) {
                console.error('Error parsing search user:', error);
                break;
            }
        }

        return {
            status: status.value,
            fieldsNum: fieldsNum.value,
            maxRows: maxRows.value,
            serverTime: serverTime.value,
            fields: fields,
            users: users
        };
    }
}

module.exports = PacketParser;