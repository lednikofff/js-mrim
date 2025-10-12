const net = require('net');
const { decodeText } = require('../protocol/constants');

class Redirector {
  static async getMainServer(host = 'mrim.mail.ru', port = 2042) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      
      socket.setTimeout(10000);
      
      socket.connect(port, host, () => {
        // Сервер должен отправить адрес главного сервера
      });
      
      socket.on('data', (data) => {
        try {
          const serverInfo = decodeText(data).trim();
          const [mainHost, mainPort] = serverInfo.split(':');
          
          socket.destroy();
          
          resolve({
            host: mainHost,
            port: parseInt(mainPort)
          });
        } catch (error) {
          reject(error);
        }
      });
      
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Redirector timeout'));
      });
    });
  }
}

module.exports = Redirector;