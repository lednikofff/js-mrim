const iconv = require('iconv-lite');

module.exports = {

  CS_MAGIC: 0xDEADBEEF,

  CS_PROTO: 65543,

  MRIM_CS_HELLO: 0x1001,
  MRIM_CS_HELLO_ACK: 0x1002,
  MRIM_CS_LOGIN2: 0x1038,
  MRIM_CS_LOGIN_ACK: 0x1004,
  MRIM_CS_LOGIN_REJ: 0x1005,
  MRIM_CS_USER_INFO: 0x1015,
  MRIM_CS_CONTACT_LIST2: 0x1037,
  MRIM_CS_PING: 0x1006,
  MRIM_CS_USER_STATUS: 0x100F,

  MRIM_CS_MESSAGE: 0x1008,        
  MRIM_CS_MESSAGE_ACK: 0x1009,    
  MRIM_CS_MESSAGE_RECV: 0x1011,   

  STATUS_OFFLINE: 0x00000000,
  STATUS_ONLINE: 0x00000001,
  STATUS_AWAY: 0x00000002,

  ENCODING: 'win1251',

  encodeText: (text) => iconv.encode(text, 'win1251'),
  decodeText: (buffer) => iconv.decode(buffer, 'win1251')
};