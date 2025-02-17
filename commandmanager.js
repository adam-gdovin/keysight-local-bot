const { EventEmitter } = require("events");
const fs = require("fs");
const minimist = require("minimist");
const DebugLog = require("./debug-log");

const ARGS = minimist(process.argv.slice(2));
const COMMANDS_FILE = ARGS.commandsFile || process.env.COMMAND_FILE || "commands.json"; // File to store the commands

/**
 * Creates a blank local JSON file for the commands
 */
function createCommandFile() {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify({}, null, 4));
}

/**
 * Reads and parses local JSON file containing the commands
 * @returns {Object} parsed contents of the commands.json file
 */
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

/**
 * Object representing a saved command
 * @class Command
 */
class Command {
    /**
     * @param {string} commandName - name of the command
     * @param {string} commandData - command's permissions, triggers, reply messages
     */
    constructor(commandName, commandData) {
        this.commandName = commandName;
        this.permissions = commandData.permissions;
        this.triggers = commandData.triggers.map(trigger => trigger.toLowerCase().replace("!", ""));
        this.message = commandData.message;
        this._success_reply = commandData.success_reply;
        this._insufficient_permissions_reply = commandData.insufficient_permissions_reply;
        this._insufficient_arguments_reply = commandData.insufficient_arguments_reply;
    }
    getKeysightMessage(chatUser, chatCommand) {
        return this._replaceWildcards(this.message, chatUser, chatCommand);
    }
    hasInsufficientPermissionsReply() {
        return !!this._insufficient_permissions_reply;
    }
    hasSuccessReply() {
        return !!this._success_reply;
    }
    hasInsufficientArgumentsReply() {
        return !!this._insufficient_arguments_reply;
    }
    getSuccessReply(chatUser, chatCommand) {
        return this._success_reply && this._replaceWildcards(this._success_reply, chatUser, chatCommand);
    }
    getInsufficientPermissionsReply(chatUser, chatCommand) {
        return this._insufficient_permissions_reply && this._replaceWildcards(this._insufficient_permissions_reply, chatUser, chatCommand);
    }
    getInsufficientArgumentsReply(chatUser, chatCommand) {
        return this._insufficient_arguments_reply && this._replaceWildcards(this._insufficient_arguments_reply, chatUser, chatCommand);
    }
    _replaceWildcards(text, chatUser, chatCommand) {
        return text.replaceAll("$cmd", this.commandName)
            .replaceAll("$msg", chatCommand.msg)
            .replaceAll("$usr", `@${chatUser.displayName}`)
            .replaceAll(`@@${chatUser.displayName}`, `@${chatUser.displayName}`)
            .replaceAll("$res", chatCommand.response);
    }

    checkUserPermissions(chatUser) {
        let allow = chatUser.isBroadcaster || this.permissions.everyone;
        allow = allow || (this.permissions.vip && chatUser.isVip);
        allow = allow || (this.permissions.mod && chatUser.isMod);
        allow = allow || (this.permissions.tier1 && chatUser.subTier === 1);
        allow = allow || (this.permissions.tier2 && chatUser.subTier === 2);
        allow = allow || (this.permissions.tier3 && chatUser.subTier === 3);
        return allow;
    }
}

/**
 * The manager class responsible for managing the commands.json file and keeping the current list of available commands
 */
class CommandManager extends EventEmitter {
    constructor() {
        super();
        this._setCommands(loadCommands() || {});
        fs.watchFile(COMMANDS_FILE, () => {
            DebugLog.info(`${COMMANDS_FILE} changed. Updating commands...`);
            const newCommandsData = loadCommands();
            if (newCommandsData) {
                this._setCommands(newCommandsData);
            }
        })
    }
    _setCommands(newCommandsData) {
        const newTriggers = {};
        const newCommands = Object.entries(newCommandsData).map(([commandName, commandData]) => new Command(commandName, commandData));

        let valid = true;
        newCommands.forEach(command => {
            command.triggers.forEach(trigger => {
                if (newTriggers.hasOwnProperty(trigger)) {
                    console.error(`⚠️ Duplicate trigger word "${trigger}" in multiple commands: "${command.commandName}" and "${newTriggers[trigger].commandName}"`);
                    valid = false;
                } else {
                    newTriggers[trigger] = command;
                }
            })
        })
        if (!valid) {
            DebugLog.warn("Commands updated, ignoring duplicate commands")
        } else {
            DebugLog.success("Commands updated")
        }
        this.triggers = newTriggers;
        this.commands = newCommands;
    }

    /**
     * 
     * @param {string} trigger - command trigger, such as !help 
     * @return {Command} object containing command data such as permissions and reply messages
     */
    getCommandFromTrigger(trigger) {
        return this.triggers[trigger] || null;
    }
}

module.exports = { CommandManager };