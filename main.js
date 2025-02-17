#!/usr/bin/env node

require("dotenv").config();
const { getValidAccessTokenData } = require("./auth");
const { ChatBot } = require("./bot");
const { WebSocket } = require("./ws");
const { CommandManager } = require("./commandmanager");

const minimist = require("minimist");
const ARGS = minimist(process.argv.slice(2));

if (ARGS.help) {
    console.log(`
    Usage: keysight_bot.exe [options]
  
    Options:
      --help            Show this help message
      --wsPort          Socket.IO port (Default 3000)
      --clientID        Twitch App client ID (Defaults to Keysight Bot)
      --channel         Twitch channel to join (Defaults to signed in user)
      --commandsFile    Path to commands.json file (Default './commands.json')
      --tokenFile       Path to token.json file (Default './token.json')
    `);
    process.exit(0);  // Stop the program after showing help
}

!(async () => {
    const tokenData = await getValidAccessTokenData();
    const commandsManager = new CommandManager();
    const ws = new WebSocket(ARGS.wsPort || process.env.WS_PORT || 3000);
    const bot = new ChatBot(tokenData.access_token, tokenData.user, ARGS.channel || tokenData.user);
    await bot.connect();
    bot.on("command", async (chatUser, chatCommand, callback) => {
        if (!ws.keysightClient) {
            console.log("Socket.IO client not connected, ignoring chat command");
            return;
        }

        const command = commandsManager.getCommandFromTrigger(chatCommand.trigger);
        if (!command)//Command not found
            return;

        //check permissions        
        if (!command.checkUserPermissions(chatUser)) {
            command.hasFailureReply() && callback(command.getFailureReply(chatUser, chatCommand));
            return;
        }

        //check if the command has sufficient arguments
        if (command.message.includes("$msg") && !chatCommand.msg.length) {
            command.hasInsufficientArgumentsReply() && callback(command.getInsufficientArgumentsReply(chatUser, chatCommand));
            return;
        }
        ws.sendMessageToKeysight(command.getKeysightMessage(chatUser, chatCommand))
            .then(() => {
                command.hasSuccessReply() && callback(command.getSuccessReply(chatUser, chatCommand));
            })
            .catch((error) => {
                command.hasFailureReply() && callback(command.getFailureReply(chatUser, chatCommand));
            })
    })
})();