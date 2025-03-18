"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const client_1 = require("./client");
const discord_js_selfbot_v13_1 = require("discord.js-selfbot-v13");
const auth_1 = require("@twurple/auth");
const api_1 = require("@twurple/api");
const wait_1 = require("./wait");
const eventsub_http_1 = require("@twurple/eventsub-http");
const express_1 = require("./express");
const authProvider = new auth_1.AppTokenAuthProvider(process.env["TWITCH_CLIENT_ID"], process.env["TWITCH_CLIENT_SECRET"]);
const apiClient = new api_1.ApiClient({ authProvider });
const twitchListener = new eventsub_http_1.EventSubMiddleware({
    apiClient,
    hostName: process.env["HOSTNAME"],
    pathPrefix: '/twitch',
    secret: process.env["SECRET"]
});
twitchListener.apply(express_1.app);
express_1.ExpressEvents.on("middlewareSetup", () => {
    twitchListener.markAsReady();
});
let channel;
const GO_LIVE_MESSAGES = [
    "NOW LIVE!!",
    "ON THE AIR!!",
    "THEY'RE LIVE!!",
    "STREAMING NOW!!",
    "NEW STREAM!!",
    "LIVE ON TWITCH!!",
    "WATCH NOW!!",
    "LIVE STREAM!!",
    "LIVE ON AIR!!",
    "TUNE IN!!",
    "GOING LIVE!!"
];
let LISTENERS = {};
let DiscordTwitchConnections = {};
function setupStreamListeners() {
    return __awaiter(this, arguments, void 0, function* (timestamp = Date.now()) {
        print("Starting...");
        return new Promise((res, rej) => {
            const user_client = new discord_js_selfbot_v13_1.Client();
            user_client.login(process.env["USER_TOKEN"]);
            user_client.once("ready", () => __awaiter(this, void 0, void 0, function* () {
                print("User Ready!...");
                let guild = yield user_client.guilds.fetch(process.env.GUILD_ID);
                let raw_members = yield guild.members.fetch();
                let members = raw_members.toJSON();
                let twitchConnections = [];
                yield members.awaitForEach((member, index) => __awaiter(this, void 0, void 0, function* () {
                    let profile = yield member.user.getProfile();
                    let theseTwitchConnections = profile.connected_accounts.filter(account => account.type == 'twitch');
                    if (theseTwitchConnections.length > 0) {
                        twitchConnections = twitchConnections.concat(theseTwitchConnections);
                        theseTwitchConnections.forEach(connection => {
                            DiscordTwitchConnections[connection.id] = member.id;
                            listenForStream(connection.id, timestamp);
                        });
                    }
                    print(`Getting Profiles: [${index + 1} / ${members.length}]: (${theseTwitchConnections.map(connection => connection.name).join(", ")})`);
                }));
                // print("Connections: ", twitchConnections)
                let listenerEntries = Object.values(LISTENERS);
                listenerEntries.filter(entry => entry.timestamp != timestamp).forEach(entry => {
                    twitchListener.removeListener(entry.listener);
                    delete LISTENERS[entry.key];
                });
                // print("Listener: ", LISTENERS)
                // twitchConnections.forEach(connection => {
                //   listenForStream(connection.id)
                // })
                user_client.destroy();
                setTimeout(setupStreamListeners, 600000);
                print("Setup all Listeners! Updating in 10 minutes!...");
                res();
            }));
        });
    });
}
const CURRENT_STREAMERS = new Set();
const LISTENING_STREAMS = new Set();
function listenForStream(userId, timestamp) {
    return __awaiter(this, void 0, void 0, function* () {
        if (LISTENING_STREAMS.has(userId)) {
            return;
        }
        LISTENING_STREAMS.add(userId);
        let member_id = DiscordTwitchConnections[userId];
        let listenerEntries = Object.values(LISTENERS).filter(entry => entry.id == userId);
        if (listenerEntries.length == 0) {
            apiClient.streams.getStreamByUserId(userId).then(stream => {
                if (stream != null) {
                    sendStreamStartedMessage(member_id, stream.userName, stream.title, stream.getThumbnailUrl(1820, 1024), stream.gameName);
                }
            });
        }
        else {
            listenerEntries.forEach(entry => {
                twitchListener.removeListener(entry.listener);
                delete LISTENERS[entry.key];
            });
        }
        let onlineListener = null;
        while (onlineListener == null) {
            onlineListener = twitchListener.onStreamOnline(userId, (event) => __awaiter(this, void 0, void 0, function* () {
                print(`verifying stream... ${userId}|${event.broadcasterName}`);
                let guild = yield client_1.client.guilds.fetch(process.env["GUILD_ID"]);
                let member = yield guild.members.fetch(member_id);
                let stream = null;
                let firstTry = true;
                while (stream == null) {
                    if (firstTry) {
                        stream = yield event.getStream();
                        firstTry = false;
                    }
                    else {
                        print("retrying to fetch stream...");
                        yield (0, wait_1.wait)(1000);
                        stream = yield apiClient.streams.getStreamByUserId(userId);
                    }
                }
                sendStreamStartedMessage(member.id, stream.userName, stream.title, stream.getThumbnailUrl(1820, 1024), stream.gameName);
            }));
        }
        let offlineListener = null;
        while (offlineListener == null) {
            offlineListener = twitchListener.onStreamOffline(userId, (event) => __awaiter(this, void 0, void 0, function* () {
                let member_id = DiscordTwitchConnections[userId];
                print(`verifying offline... ${userId}|${event.broadcasterName}`);
                if (CURRENT_STREAMERS.has(member_id)) {
                    console.log(`${event.broadcasterName} (<@${member_id}>) is no longer streaming...💥`);
                    CURRENT_STREAMERS.delete(member_id);
                }
            }));
        }
        // print("Listening... ==> ", onlineListener, offlineListener)
        LISTENERS[`${userId}_online_${timestamp}`] = { id: userId, lisetner: onlineListener, timestamp, key: `${userId}_online_${timestamp}` };
        LISTENERS[`${userId}_offline_${timestamp}`] = { id: userId, lisetner: offlineListener, timestamp, key: `${userId}_offline_${timestamp}` };
    });
}
client_1.client.on("ready", () => __awaiter(void 0, void 0, void 0, function* () {
    setupStreamListeners();
    // setInterval(setupStreamListeners, 10000)
    // let guild = await client.guilds.fetch(process.env.GUILD_ID)
    // let memberz = await guild.members.fetch()
    // print("We've cached: ", memberz.map(member => (member.nickname || member.displayName)))
}));
client_1.client.on("presenceUpdate", (oldPresence, newPresence) => __awaiter(void 0, void 0, void 0, function* () {
    let guild = newPresence.guild;
    let member = newPresence.member;
    if (guild.id != process.env.GUILD_ID) {
        return;
    }
    // print("Activities: ", newPresence.activities)
    let streamingActivity = (newPresence.activities || []).find(activity => activity.type == discord_js_1.ActivityType.Streaming);
    if (streamingActivity != null) {
        // console.log(newPresence.activities)
        if (channel == null) {
            channel = (yield client_1.client.channels.fetch(process.env.LIVE_CHANNEL_ID));
        }
        client_1.client.channels.fetch(process.env.LIVE_CHANNEL_ID).then((channel) => {
            var _a;
            let twitchUsername = streamingActivity.url.split("/").pop();
            sendStreamStartedMessage(member.id, twitchUsername, streamingActivity.details, (_a = streamingActivity.assets) === null || _a === void 0 ? void 0 : _a.largeImageURL({ size: 1024 }), streamingActivity.state);
        });
    }
}));
function sendStreamStartedMessage(memberId, twitchUsername, streamDesc, thumbnailUrl, game) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!CURRENT_STREAMERS.has(memberId)) {
            CURRENT_STREAMERS.add(memberId);
            console.log(`${twitchUsername} (<@${memberId}>) is now streaming!`);
            channel = (yield client_1.client.channels.fetch(process.env["LIVE_CHANNEL_ID"]));
            return channel.send({ content: `# 🔴 ${GO_LIVE_MESSAGES.random()}`, embeds: [
                    {
                        title: `<:twitch:1329250863692124160> __@${twitchUsername}__`,
                        description: `<@${memberId}>: ${streamDesc}`,
                        url: `https://twitch.tv/${twitchUsername}`,
                        image: {
                            url: thumbnailUrl,
                        },
                        color: 0x6441A4,
                        footer: {
                            text: game
                        }
                    }
                ] });
        }
        else {
            return null;
        }
    });
}
