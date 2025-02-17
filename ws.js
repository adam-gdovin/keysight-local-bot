const { EventEmitter } = require("events");
const io = require("socket.io");

/**
 * Class responsible for handling Socket.IO communication with Keysight
 */
class WebSocket extends EventEmitter {
    constructor(port) {
        super();
        this.keysightClient = null;
        this.socket = io(port, { pingInterval: 15000, pingTimeout: 5000 });
        console.log(`✔ Socket.IO server started. http://localhost:${port}`);
        this.socket.on("connection", (clientSocket) => {
            if (this.keysightClient) {
                console.log('✘ Rejecting new Socket.IO client:', clientSocket.id);
                clientSocket.emit('error', 'Only one client allowed at a time.');
                clientSocket.disconnect(true); // Force disconnect the new client
                return;
            }

            this.keysightClient = clientSocket;
            console.log('✔ Socket.IO client connected:', clientSocket.id);

            clientSocket.on('disconnect', () => {
                console.log('✘ Socket.IO client disconnected:', clientSocket.id);
                if (this.keysightClient.id === clientSocket.id) {
                    this.keysightClient = null; // Allow a new connection
                }
            });
        });
    }

    /**
     * Sends a message to Keysight over socket.io, returns a Promise acknowledging successful reply
     * @param {string} message - text to send to Keysight
     * @returns {Promise<void>} - Promise resolves if Keysight successfully replies, rejects if message times out after 5 seconds
     */
    sendMessageToKeysight(message) {
        return new Promise((resolve, reject) => {
            if (!this.keysightClient) {
                reject();
            }

            this.keysightClient.once(message.substr(0, 20), resolve);
            this.keysightClient.emit("command", message);
            setTimeout(() => {
                this.keysightClient.removeListener(message.substr(0, 20), resolve);
                reject();
            }, 5000)
        })
    }
}

module.exports = { WebSocket };