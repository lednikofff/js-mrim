module.exports = {
  server: {
    host: process.env.MRIM_HOST || 'mrim.mail.ru',
    port: parseInt(process.env.MRIM_PORT) || 2042
  },
  credentials: {
    login: process.env.MRIM_LOGIN || '',
    password: process.env.MRIM_PASSWORD || '',
    status: parseInt(process.env.MRIM_STATUS) || 0x00000001 
  },
  client: {
    pingInterval: 60000,
    connectionTimeout: 30000,
    autoReconnect: true,
    reconnectDelay: 5000,
    debug: process.env.MRIM_DEBUG === 'true' || false
  }
};