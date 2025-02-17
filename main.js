require("dotenv").config();
const { getValidAccessTokenData } = require("./auth");
const { ChatBot } = require("./bot");
const { WebSocket } = require("./ws");
const { CommandManager } = require("./commands");

//Initialize the electron app
!(async () => {
    const tokenData = await getValidAccessTokenData();
    const commandsManager = new CommandManager();
    const ws = new WebSocket();
    const bot = new ChatBot(tokenData.access_token, tokenData.channel);
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

        ws.sendMessageToKeysight(command.getKeysightMessage(chatUser, chatCommand))
            .then(() => {
                command.hasSuccessReply() && callback(command.getSuccessReply(chatUser, chatCommand));
            })
            .catch((error) => {
                command.hasFailureReply() && callback(command.getFailureReply(chatUser, chatCommand));
            })
    })
})();