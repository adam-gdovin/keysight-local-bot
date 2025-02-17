const io = require('socket.io-client');
require("dotenv").config();

// Connect to the Socket.IO server (change URL if needed)
const socket = io(`http://localhost:${process.env.WS_PORT}`, {
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
    socket.emit(data.substr(0,20), "yep");
});
// Handle disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
});