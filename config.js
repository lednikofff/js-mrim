// config.js
module.exports = {
  // Параметры подключения к MRIM серверу
  server: {
    host: process.env.MRIM_HOST || 'mrim.mail.ru',
    port: parseInt(process.env.MRIM_PORT) || 2042
  },
  
  // Учетные данные (можно переопределить при создании клиента)
  credentials: {
    login: process.env.MRIM_LOGIN || '',
    password: process.env.MRIM_PASSWORD || '',
    status: parseInt(process.env.MRIM_STATUS) || 0x00000001 // ONLINE
  },
  
  // Настройки клиента
  client: {
    // Интервал пинга в миллисекундах
    pingInterval: 60000,
    
    // Таймаут подключения
    connectionTimeout: 30000,
    
    // Автоматическое переподключение
    autoReconnect: true,
    reconnectDelay: 5000,
    
    // Логирование
    debug: process.env.MRIM_DEBUG === 'true' || false
  }
};