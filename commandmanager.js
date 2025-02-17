const { EventEmitter } = require("events");
const fs = require("fs");

const COMMANDS_FILE = process.env.COMMAND_FILE || "commands.json"; // File to store the commands

function createCommandFile() {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify({}, null, 4));
}
function loadCommands() {
    if (fs.existsSync(COMMANDS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(COMMANDS_FILE, "utf-8"));
        } catch (er) {
            console.error(`${COMMANDS_FILE} couldn't be parsed: ${er}`);
            return null;
        }
    }
    console.warn("🔹 Commands file doesn't exist, creating an empty file");
    createCommandFile();
    return {};
}

class Command {
    constructor(commandName, commandData) {
        this.commandName = commandName;
        this.permissions = commandData.permissions;
        this.triggers = commandData.triggers.map(trigger => trigger.toLowerCase());
        this.message = commandData.message;
        this._success_reply = commandData.success_reply;
        this._failure_reply = commandData.failure_reply;
    }
    getKeysightMessage(chatUser, chatCommand){
        return this._replaceWildcards(this.message, chatUser, chatCommand);
    }
    hasFailureReply() {
        return !!this._failure_reply;
    }
    hasSuccessReply() {
        return !!this._success_reply;
    }
    getSuccessReply(chatUser, chatCommand) {
        return this._success_reply && this._replaceWildcards(this._success_reply, chatUser, chatCommand);
    }
    getFailureReply(chatUser, chatCommand) {
        return this._failure_reply && this._replaceWildcards(this._failure_reply, chatUser, chatCommand);
    }
    _replaceWildcards(text, chatUser, chatCommand) {
        return text.replaceAll("$cmd", this.commandName).replaceAll("$msg", chatCommand.msg).replaceAll("$usr", chatUser.displayName)
    }
    checkUserPermissions(chatUser){
        let allow = chatUser.isBroadcaster;
        allow = allow || (this.permissions.vip && chatUser.isVip);
        allow = allow || (this.permissions.mod && chatUser.isMod);
        allow = allow || (this.permissions.tier1 && chatUser.subTier === 1);
        allow = allow || (this.permissions.tier2 && chatUser.subTier === 2);
        allow = allow || (this.permissions.tier3 && chatUser.subTier === 3);
        return allow;
    }
}

class CommandManager extends EventEmitter {
    constructor() {
        super();
        this.setCommands(loadCommands() || {});
        fs.watchFile(COMMANDS_FILE, () => {
            console.log(`🔹 ${COMMANDS_FILE} changed. Updating commands...`)
            const newCommandsData = loadCommands();
            if (newCommandsData) {
                this.setCommands(newCommandsData);
            }
        })
    }
    setCommands(newCommandsData) {
        const newTriggers = {};
        const newCommands = Object.entries(newCommandsData).map(([commandName, commandData]) => new Command(commandName, commandData));

        let valid = true;
        newCommands.forEach(command => {
            command.triggers.forEach(trigger => {
                if (newTriggers.hasOwnProperty(trigger)) {
                    console.error(`⚠️ Duplicate trigger word "${trigger}" in multiple commands: "${command.commandName}" and "${newTriggers[trigger].commandName}"`);
                    valid = false;
                }else{
                    newTriggers[trigger] = command;
                }
            })
        })
        if(!valid){
            console.warn("⚠️ Commands updated, ignoring duplicate commands")
        }else{
            console.warn("✅ Commands updated")
        }
        this.triggers = newTriggers;
        this.commands = newCommands;
    }

    getCommandFromTrigger(trigger) {
        return this.triggers[trigger] ? this.triggers[trigger] : null;
    }
}

module.exports = { CommandManager };