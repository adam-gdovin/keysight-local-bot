const io = require("socket.io-client");
const minimist = require("minimist");
const ARGS = minimist(process.argv.slice(2));

// Connect to the Socket.IO server (change URL if needed)
const socket = io(`http://localhost:${ARGS.wsPort || 3000}`, {
    reconnection: true
});

// Listen for connection success
socket.on('connect', () => {
    console.log('Connected to server as:', socket.id);
});

// Listen for all events dynamically (Socket.IO v2.3.0 syntax)
socket.on('command', (data) => {
    console.log(data);

    // Send a response back
    socket.emit(data.substr(0, 20), "yep");
});
// Handle disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
});