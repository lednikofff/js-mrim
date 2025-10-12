const EventEmitter = require('events');
const MrimConnection = require('./network/Connection');
const Redirector = require('./network/Redirector');
const PacketBuilder = require('./protocol/PacketBuilder');
const PacketParser = require('./protocol/PacketParser');
const constants = require('./protocol/constants');

class MrimClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      host: options.host || 'mrim.mail.ru',
      port: options.port || 2042,
      userAgent: options.userAgent || 'Node.js MRIM Client',
      pingInterval: options.pingInterval || 60000,
      connectionTimeout: options.connectionTimeout || 30000,
      autoReconnect: options.autoReconnect !== false,
      reconnectDelay: options.reconnectDelay || 5000,
      debug: options.debug || false,
      ...options
    };

    this.connection = new MrimConnection();
    this.packetBuilder = new PacketBuilder();
    this.isAuthorized = false;
    this.pingInterval = null;
    this.pingPeriod = 60;
    this.reconnectTimeout = null;
    this.credentials = null;
    this.contacts = new Map();
    this.groups = new Map();

    this.setupHandlers();
  }

  setupHandlers() {
    this.connection.on('connected', () => {
      this.emit('connected');
      this.sendHello();
    });

    this.connection.on('disconnected', () => {
      this.emit('disconnected');
      this.stopPing();
      this.isAuthorized = false;

      if (this.options.autoReconnect && this.credentials) {
        this.reconnectTimeout = setTimeout(() => {
          this.emit('debug', 'Attempting to reconnect...');
          this.reconnect();
        }, this.options.reconnectDelay);
      }
    });

    this.connection.on('error', (error) => {
      this.emit('error', error);
    });

    this.connection.on('packet', (header, packet) => {
      this.handlePacket(header, packet);
    });
  }

  async connect() {
    try {
      this.emit('debug', `Getting main server from redirector: ${this.options.host}:${this.options.port}`);

      const mainServer = await Redirector.getMainServer(
        this.options.host, 
        this.options.port
      );

      this.emit('debug', `Connecting to main server: ${mainServer.host}:${mainServer.port}`);

      await this.connection.connect(mainServer.host, mainServer.port);

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async reconnect() {
    try {
      await this.connect();
      if (this.credentials) {
        this.login(this.credentials.email, this.credentials.password, this.credentials.status);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  sendHello() {
    const helloPacket = this.packetBuilder.buildHello();
    this.connection.send(helloPacket);
    this.emit('debug', 'Sent MRIM_CS_HELLO');
  }

  login(email, password, status = constants.STATUS_ONLINE) {
    this.credentials = { email, password, status };

    const loginPacket = this.packetBuilder.buildLogin2(
      email,
      password,
      status,
      this.options.userAgent
    );

    this.connection.send(loginPacket);
    this.emit('debug', `Sent MRIM_CS_LOGIN2 for ${email}`);
  }

  sendMessage(to, message) {
    if (!this.isAuthorized) {
      throw new Error('Not authorized. Please login first.');
    }

    const messagePacket = this.packetBuilder.buildMessage(to, message);
    this.connection.send(messagePacket);
    this.emit('debug', `Sent message to ${to}`);
    this.emit('messageSent', { to, message });
  }

  sendMessageRecv(from, msgId) {
    const recvPacket = this.packetBuilder.buildMessageRecv(from, msgId);
    this.connection.send(recvPacket);
    this.emit('debug', `Sent delivery confirmation for message ${msgId} from ${from}`);
  }

  sendPing() {
    const pingPacket = this.packetBuilder.buildPing();
    this.connection.send(pingPacket);
    this.emit('debug', 'Sent MRIM_CS_PING');
  }

  handlePacket(header, packet) {
    this.emit('debug', `Received packet: 0x${header.msg.toString(16)}`);

    switch (header.msg) {
      case constants.MRIM_CS_HELLO_ACK:
        this.handleHelloAck(header.body);
        break;

      case constants.MRIM_CS_LOGIN_ACK:
        this.handleLoginAck(header.body);
        break;

      case constants.MRIM_CS_LOGIN_REJ:
        this.handleLoginRej(header.body);
        break;

      case constants.MRIM_CS_CONTACT_LIST2:
        this.handleContactList(header.body);
        break;

      case constants.MRIM_CS_USER_STATUS:
        this.handleUserStatus(header.body);
        break;

      case constants.MRIM_CS_USER_INFO:
        this.handleUserInfo(header.body);
        break;

      case constants.MRIM_CS_MESSAGE_ACK:
        this.handleMessageAck(header.body);
        break;

      case constants.MRIM_CS_ADD_CONTACT_ACK:
        this.handleAddContactAck(header.body);
        break;

      case constants.MRIM_CS_MODIFY_CONTACT_ACK:
        this.handleModifyContactAck(header.body);
        break;

      default:
        this.emit('unknownPacket', header, packet);
    }
  }

  handleHelloAck(body) {
    const { pingPeriod } = PacketParser.parseHelloAck(body);
    this.pingPeriod = pingPeriod;

    this.emit('helloAck', { pingPeriod });
    this.emit('debug', `Received HELLO_ACK, ping period: ${pingPeriod}s`);
  }

  handleLoginAck(body) {
    this.isAuthorized = true;
    this.startPing();

    this.emit('loginAck');
    this.emit('authorized');
    this.emit('debug', 'Login successful - authorized');
  }

  handleLoginRej(body) {
    this.isAuthorized = false;
    this.credentials = null;

    this.emit('loginRejected');
    this.emit('debug', 'Login rejected - invalid credentials');
  }

  handleContactList(body) {
    try {
      const contactListData = PacketParser.parseContactList(body);

      this.groups.clear();
      contactListData.groups.forEach((group, index) => {
        this.groups.set(index, {
          id: index,
          name: group.name,
          flags: group.flags
        });
      });

      this.contacts.clear();
      contactListData.contacts.forEach(contact => {
        this.contacts.set(contact.email, {
          id: contact.email,
          email: contact.email,
          nickname: contact.nickname,
          flags: contact.flags,
          groupIndex: contact.groupIndex,
          authFlags: contact.authFlags,
          status: contact.status,
          groupName: this.groups.get(contact.groupIndex)?.name || 'Unknown'
        });
      });

      const statusMap = {
        [constants.GET_CONTACTS_OK]: 'success',
        [constants.GET_CONTACTS_ERROR]: 'error', 
        [constants.GET_CONTACTS_INTERR]: 'internal_error'
      };

      this.emit('contactList', {
        status: contactListData.status,
        statusText: statusMap[contactListData.status] || 'unknown',
        groups: contactListData.groups,
        contacts: contactListData.contacts,
        groupMask: contactListData.groupMask,
        contactsMask: contactListData.contactsMask
      });

      this.emit('debug', `Received contact list: ${contactListData.contacts.length} contacts, ${contactListData.groups.length} groups, status: ${statusMap[contactListData.status]}`);

    } catch (error) {
      this.emit('error', new Error(`Failed to parse contact list: ${error.message}`));
    }
  }

  handleUserStatus(body) {
    try {
      const userStatus = PacketParser.parseUserStatus(body);
      this.emit('userStatus', userStatus);
      this.emit('debug', `User ${userStatus.email} status changed to ${userStatus.status}`);
    } catch (error) {
      this.emit('error', new Error(`Failed to parse user status: ${error.message}`));
    }
  }

  handleUserInfo(body) {
    this.emit('userInfo', {});
    this.emit('debug', 'Received user info');
  }

  handleMessageAck(body) {
    try {
      const messageData = PacketParser.parseMessageAck(body);

      this.sendMessageRecv(messageData.from, messageData.msgId);

      this.emit('message', {
        id: messageData.msgId,
        from: messageData.from,
        text: messageData.message,
        flags: messageData.flags,
        rtf: messageData.rtf
      });

      this.emit('debug', `Received message from ${messageData.from}: ${messageData.message}`);
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${error.message}`));
    }
  }

  handleAddContactAck(body) {
    try {
      const result = PacketParser.parseAddContactAck(body);

      const statusMap = {
        [constants.CONTACT_OPER_SUCCESS]: 'success',
        [constants.CONTACT_OPER_ERROR]: 'error',
        [constants.CONTACT_OPER_INTERR]: 'internal_error',
        [constants.CONTACT_OPER_NO_SUCH_USER]: 'no_such_user',
        [constants.CONTACT_OPER_INVALID_INFO]: 'invalid_info',
        [constants.CONTACT_OPER_USER_EXISTS]: 'user_exists',
        [constants.CONTACT_OPER_GROUP_LIMIT]: 'group_limit'
      };

      this.emit('contactAdded', {
        status: result.status,
        statusText: statusMap[result.status] || 'unknown',
        contactId: result.contactId
      });

      this.emit('debug', `Contact add result: ${statusMap[result.status]} (ID: ${result.contactId})`);
    } catch (error) {
      this.emit('error', new Error(`Failed to parse contact add ack: ${error.message}`));
    }
  }

  handleModifyContactAck(body) {
    try {
      const result = PacketParser.parseModifyContactAck(body);

      const statusMap = {
        [constants.CONTACT_OPER_SUCCESS]: 'success',
        [constants.CONTACT_OPER_ERROR]: 'error',
        [constants.CONTACT_OPER_INTERR]: 'internal_error',
        [constants.CONTACT_OPER_NO_SUCH_USER]: 'no_such_user',
        [constants.CONTACT_OPER_INVALID_INFO]: 'invalid_info',
        [constants.CONTACT_OPER_USER_EXISTS]: 'user_exists',
        [constants.CONTACT_OPER_GROUP_LIMIT]: 'group_limit'
      };

      this.emit('contactModified', {
        status: result.status,
        statusText: statusMap[result.status] || 'unknown'
      });

      this.emit('debug', `Contact modify result: ${statusMap[result.status]}`);
    } catch (error) {
      this.emit('error', new Error(`Failed to parse contact modify ack: ${error.message}`));
    }
  }

  addContact(email, name, groupId = 0, flags = 0) {
    if (!this.isAuthorized) {
      throw new Error('Not authorized. Please login first.');
    }

    const packet = this.packetBuilder.buildAddContact(flags, groupId, email, name);
    this.connection.send(packet);
    this.emit('debug', `Adding contact: ${email} (${name}) to group ${groupId}`);
  }

  addGroup(groupName, flags = constants.CONTACT_FLAG_GROUP) {
    if (!this.isAuthorized) {
      throw new Error('Not authorized. Please login first.');
    }

    const packet = this.packetBuilder.buildAddGroup(flags, groupName);
    this.connection.send(packet);
    this.emit('debug', `Adding group: ${groupName}`);
  }

  modifyContact(contactId, flags, groupId, email, name) {
    if (!this.isAuthorized) {
      throw new Error('Not authorized. Please login first.');
    }

    const packet = this.packetBuilder.buildModifyContact(contactId, flags, groupId, email, name);
    this.connection.send(packet);
    this.emit('debug', `Modifying contact ID ${contactId}: ${email} (${name})`);
  }

  removeContact(contactId, email) {
    this.modifyContact(
      contactId,
      constants.CONTACT_FLAG_REMOVED,
      0,
      email,
      ''
    );
    this.emit('debug', `Removing contact ID ${contactId}: ${email}`);
  }

  addToInvisible(contactId, email, name) {
    this.modifyContact(
      contactId,
      constants.CONTACT_FLAG_INVISIBLE | constants.CONTACT_FLAG_SHADOW,
      0,
      email,
      name
    );
  }

  addToIgnore(contactId, email, name) {
    this.modifyContact(
      contactId,
      constants.CONTACT_FLAG_IGNORE | constants.CONTACT_FLAG_SHADOW,
      0,
      email,
      name
    );
  }

  getContacts() {
    return Array.from(this.contacts.values());
  }

  getGroups() {
    return Array.from(this.groups.values());
  }

  findContactByEmail(email) {
    return this.contacts.get(email);
  }

  getGroupById(groupId) {
    return this.groups.get(groupId);
  }

  findGroupByName(name) {
    return this.getGroups().find(group => group.name === name);
  }

  getContactsInGroup(groupId) {
    return this.getContacts().filter(contact => contact.groupIndex === groupId);
  }

  getUnauthorizedContacts() {
    return this.getContacts().filter(contact => 
      contact.authFlags & constants.CONTACT_INTFLAG_NOT_AUTHORIZED
    );
  }

  getOnlineContacts() {
    return this.getContacts().filter(contact => 
      contact.status === constants.STATUS_ONLINE
    );
  }

  startPing() {
    this.stopPing();

    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.pingPeriod * 1000);

    this.emit('debug', `Started ping interval: ${this.pingPeriod}s`);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      this.emit('debug', 'Stopped ping interval');
    }
  }

  disconnect() {
    this.stopPing();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.connection.disconnect();
    this.isAuthorized = false;
    this.emit('debug', 'Disconnected from server');
  }

  isConnected() {
    return this.connection.isConnected;
  }

  isLoggedIn() {
    return this.isAuthorized;
  }

  getStatus() {
    return {
      connected: this.isConnected(),
      authorized: this.isLoggedIn(),
      pingPeriod: this.pingPeriod,
      contactsCount: this.contacts.size,
      groupsCount: this.groups.size,
      credentials: this.credentials ? {
        email: this.credentials.email,
        status: this.credentials.status
      } : null
    };
  }
}

module.exports = MrimClient;