const tmi = require("tmi.js");
const { EventEmitter } = require("events");
const DebugLog = require("./debug-log");

/**
 * User object at the moment of their message
 * @class ChatUser
 */
class ChatUser {
    /**
     * @param {Object} twitchUserData - USERSTATE IRC object defined by Twitch, contains badges needed to read sub tiers
     */
    constructor(twitchUserData) {
        this.isBroadcaster = !!(twitchUserData.badges && twitchUserData.badges.broadcaster);
        this.isMod = !!twitchUserData.mod;
        this.isVip = !!twitchUserData.vip;
        this.isSub = !!twitchUserData.subscriber;
        this.color = twitchUserData.color;
        this.username = twitchUserData.username;
        this.displayName = twitchUserData["display-name"];
        if (this.isSub && twitchUserData.badges && twitchUserData.badges.subscriber) {
            // Subscriber badge is the only way to tell the sub tier just from the USERSTATE
            // XX or 10XX = Tier 1, 20XX = Tier 2, 30XX = Tier 3
            if (String(twitchUserData.badges.subscriber).length === 4)
                this.subTier = Number(String(twitchUserData.badges.subscriber)[0]);
            else
                this.subTier = 1;
        } else {
            this.subTier = null;
        }
    }
}

/**
 * Chat command object
 * @class ChatCommand
 */
class ChatCommand {
    /**
     * @param {string} message - full message as posted by the user in the chat 
     */
    constructor(message) {
        const [trigger, ...args] = message.split(" ");
        this.trigger = trigger.replace("!", "");
        this.msg = message.substr(trigger.length).trim();
    }
}

/**
 * The bot class responsible for handling reading/sending to twitch chat
 */
class ChatBot extends EventEmitter {
    /**
     * 
     * @param {string} accessToken - User's access token
     * @param {*} user - Signed in user's twitch username (this is likely their bot account)
     * @param {*} channel  - Channel to monitor (this is liekly the stream account)
     */
    constructor(accessToken, user, channel) {
        super();
        this.responses = true;
        this.channel = channel;
        this.client = new tmi.Client({
            skipMembership: true,
            skipUpdatingEmotesets: true,
            identity: {
                username: user,
                password: `oauth:${accessToken}`,
            },
            channels: [channel],
        });

        this.client.on("connected", () => DebugLog.success("Bot connected."));
        this.client.on("message", (channel, userstate, message) => {
            if (message.startsWith("!")) {
                const user = new ChatUser(userstate);
                const command = new ChatCommand(message)
                this.emit("command", user, command, (reply) => {
                    this.sendMessage(user, reply);
                });

                //Special case to turn off the responses globally
                if (command.trigger === "responses" && (user.isMod || user.isBroadcaster)) {
                    if (command.msg.toLowerCase() === "off")
                        this.responses = false;
                    if (command.msg.toLowerCase() === "on")
                        this.responses = true;
                }
            }
        });

    }
    /**
     * Connects the bot to twitch
     * @returns 
     */
    async connect() {
        return await this.client.connect();
    }
    /**
     * Sends a message to the monitored channel
     * @param {Object} user - ChatUser object, chatter's DisplayName is prefixed before the message
     * @param {string} message - message to send in the chat
     */
    sendMessage(user, message) {
        if (this.responses)
            this.client.say(this.channel, message);
    }
}

module.exports = { ChatBot };