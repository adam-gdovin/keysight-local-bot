const { EventEmitter } = require("events");
const io = require("socket.io");
const DebugLog = require("./debug-log");

/**
 * Class responsible for handling Socket.IO communication with Keysight
 */
class WebSocket extends EventEmitter {
    constructor(port) {
        super();
        this.keysightClient = null;
        this.socket = io(port, { pingInterval: 15000, pingTimeout: 5000 });
        DebugLog.success(`Socket.IO server started. http://localhost:${port}`);
        this.socket.on("connection", (clientSocket) => {
            if (this.keysightClient) {
                DebugLog.error("Rejecting new Socket.IO client:", clientSocket.id);
                clientSocket.emit("error", "Only one client allowed at a time.");
                clientSocket.disconnect(true); // Force disconnect the new client
                return;
            }

            this.keysightClient = clientSocket;
            DebugLog.success("Socket.IO client connected:", clientSocket.id);

            clientSocket.on('disconnect', () => {
                DebugLog.error("Socket.IO client disconnected:", clientSocket.id);
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
    sendMessageToKeysight(command, chatCommand, chatUser) {
        return new Promise((resolve, reject) => {
            let resolved = false;
            if (!this.keysightClient) {
                reject();
            }
            const message = command.getKeysightMessage(chatUser, chatCommand);
            const getResponse = (response) => {
                resolved = true;
                resolve(response);
            }            
            this.keysightClient.once(message.substr(0, 20), getResponse);
            this.keysightClient.emit("command", message);
            setTimeout(() => {
                if(resolved)
                    return;
                this.keysightClient.removeListener(message.substr(0, 20), getResponse);
                reject();
            }, 5000)
        })
    }
}

module.exports = { WebSocket };