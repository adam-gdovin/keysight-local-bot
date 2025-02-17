const tmi = require("tmi.js");
const { EventEmitter } = require("events");

class ChatUser {
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
        }else{
            this.subTier = null;
        }
    }
}

class ChatCommand {
    constructor(message) {
        const [trigger, ...args]  = message.split(" ");
        this.trigger = trigger;
        this.msg = message.substr(trigger.length).trim();
        console.log(this.msg);
    }
}

class ChatBot extends EventEmitter {
    constructor(accessToken, channel) {
        super();
        this.channel = channel;
        this.client = new tmi.Client({
            skipMembership: true,
            skipUpdatingEmotesets: true,
            identity: {
                username: "CeLLko",
                password: `oauth:${accessToken}`,
            },
            channels: [channel],
        });

        this.client.on("connected", () => console.log("✅ Bot connected."));
        this.client.on("message", (channel, userstate, message) => {
            if (message.startsWith("!")) {
                const user = new ChatUser(userstate);
                const command = new ChatCommand(message)
                this.emit("command", user, command, (reply) => {
                    this.sendMessage(user, reply);
                });
            }
        });

    }
    async connect() {
        return await this.client.connect();
    }
    sendMessage(user, message) {
        console.log(user, message)
        this.client.say(this.channel, `@${user.displayName} ${message}`);
    }
}


module.exports = { ChatBot };