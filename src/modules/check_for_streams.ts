import { ActivityType, Guild, TextChannel } from "discord.js"
import { client } from "./client"

import { Client } from "discord.js-selfbot-v13"

import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient, HelixStream, UserIdResolvable } from "@twurple/api";
import { wait } from "./wait";
import { EventSubMiddleware } from "@twurple/eventsub-http";
// import { EventSubWsListener } from "@twurple/eventsub-ws";
import { EventSubSubscription } from "@twurple/eventsub-base";
import { app, ExpressEvents } from "./express";

const authProvider = new AppTokenAuthProvider(process.env["TWITCH_CLIENT_ID"], process.env["TWITCH_CLIENT_SECRET"]);
const apiClient = new ApiClient({ authProvider })
const twitchListener = new EventSubMiddleware({
  apiClient,
  hostName: process.env["HOSTNAME"],
  pathPrefix: '/twitch',
  secret: process.env["SECRET"],
})

print("authProvider: ", authProvider)
print("apiClient: ", apiClient)
print("twitchListener: ", twitchListener)


// twitchListener.onUserSocketConnect(console.log.bind(null, "twitchListener.onUserSocketConnect: "))
// twitchListener.onSubscriptionCreateFailure(console.log.bind(null, "twitchListener.onSubscriptionCreateFailure: "))
// twitchListener.onSubscriptionCreateSuccess(console.log.bind(null, "twitchListener.onSubscriptionCreateSuccess: "))

// twitchListener.start()

twitchListener.apply(app as any)
ExpressEvents.on("middlewareSetup", () => {
  twitchListener.markAsReady()
})

let channel: TextChannel

const GO_LIVE_MESSAGES = [
  "NOW LIVE!!",
  "ON THE AIR!!",
  "THEY'RE LIVE!!",
  "STREAMING NOW!!",
  "NEW STREAM!!",
  "LIVE ON %%PLATFORM%%!!",
  "WATCH NOW!!",
  "LIVE STREAM!!",
  "LIVE ON AIR!!",
  "TUNE IN!!",
  "GOING LIVE!!"
]

const TWITCH_EMOJI = "<:twitch:1329250863692124160>"
const YOUTUBE_EMOJI = "<:youtube:1397664187160854678>"

type LISTENER_ENTRY = {id: string; listener: null | EventSubSubscription; timestamp: number; key: string}

let LISTENERS: {[key: string]: LISTENER_ENTRY} = {}
let DiscordTwitchConnections: {[twitch_user_id: string]: string} = {}
async function setupStreamListeners(timestamp = Date.now()) {
  print("Starting...")
  return new Promise<void>((res, rej) => {
    const user_client = new Client()
    user_client.login(process.env["USER_TOKEN"])

    user_client.once("ready", async () => {
      print("User Ready!...")
      let guild = await user_client.guilds.fetch(process.env.GUILD_ID)
      let raw_members = await guild.members.fetch()
      let members = raw_members.toJSON()
      
      let twitchConnections = []

      await members.awaitForEach(async (member, index) => {
        let profile = await member.user.getProfile()
        let theseTwitchConnections = profile.connected_accounts.filter(account => account.type == 'twitch')
        if (theseTwitchConnections.length > 0) {
          twitchConnections = twitchConnections.concat(theseTwitchConnections)
          theseTwitchConnections.forEach(connection => {
            DiscordTwitchConnections[connection.id] = member.id

            listenForStream(connection.id, timestamp)
          })
        }
        print(`Getting Profiles: [${index+1} / ${members.length}]: (${theseTwitchConnections.map(connection => connection.name).join(", ")})`)
      })

      // print("Connections: ", twitchConnections)

      let listenerEntries: LISTENER_ENTRY[] = Object.values(LISTENERS)
      listenerEntries.filter(entry => entry.timestamp != timestamp).forEach(entry => {
        twitchListener.removeListener()
        delete LISTENERS[entry.key]
      })
      // print("Listener: ", LISTENERS)
      // twitchConnections.forEach(connection => {
      //   listenForStream(connection.id)
      // })

      user_client.destroy()
      setTimeout(setupStreamListeners, 600000)
      print("Setup all Listeners! Updating in 10 minutes!...")
      res()
    })
  })
}

const CURRENT_STREAMERS = new Set<string>()
async function addCurrentStreamer(member_id: string) {
  CURRENT_STREAMERS.add(member_id)

  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  await guild.members.addRole({
    user: member_id,
    role: process.env.LIVE_ROLE_ID
  })
}
async function removeCurrentStreamer(member_id: string) {
  CURRENT_STREAMERS.delete(member_id)
  
  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  await guild.members.removeRole({
    user: member_id,
    role: process.env.LIVE_ROLE_ID
  })
}
const LISTENING_STREAMS = new Set<string>()

async function listenForStream(userId: UserIdResolvable, timestamp: number) {
  if (LISTENING_STREAMS.has(userId as string)) { return }
  LISTENING_STREAMS.add(userId as string)

  let member_id = DiscordTwitchConnections[userId as string]

  let listenerEntries: any[] = (Object.values(LISTENERS) as any[]).filter(entry => entry.id == userId)
  if (listenerEntries.length == 0) {
    apiClient.streams.getStreamByUserId(userId).then(stream => {
      if (stream != null) {
        sendStreamStartedMessage(member_id, {
          header: stream.userName,
          platform: "TWITCH",
          url: `https://twitch.tv/${stream.userName}`,
          desc: stream.title,
          thumbnail: stream.getThumbnailUrl(1820, 1024),
          footer: stream.gameName
        })
      }
    })
  } else {
    listenerEntries.forEach(entry => {
      twitchListener.removeListener(entry.listener)
      delete LISTENERS[entry.key]
    })
  }
  
  let onlineListener: null | EventSubSubscription = null

  onlineListener = twitchListener.onStreamOnline(userId, async (event) => {
    print(`verifying stream... ${userId}|${event.broadcasterName}`)
    let guild = await client.guilds.fetch(process.env["GUILD_ID"])
    let member = await guild.members.fetch(member_id)

    let stream: null | HelixStream = null
    let firstTry = true
    while (stream == null) {
      if (firstTry) {
        stream = await event.getStream()
        firstTry = false
      } else {
        print("retrying to fetch stream...")
        await wait(1000)
        stream = await apiClient.streams.getStreamByUserId(userId)
      }
    }

    sendStreamStartedMessage(member.id, {
      header: stream.userName,
      platform: "TWITCH",
      url: `https://twitch.tv/${stream.userName}`,
      desc: stream.title,
      thumbnail: stream.getThumbnailUrl(1820, 1024),
      footer: stream.gameName,
    })
  })


  let offlineListener: null | EventSubSubscription = null

  offlineListener = twitchListener.onStreamOffline(userId, async (event) => {
    let member_id = DiscordTwitchConnections[userId as string]

    print(`verifying offline... ${userId}|${event.broadcasterName}`)
    if (CURRENT_STREAMERS.has(member_id)) {
      console.log(`${event.broadcasterName} (<@${member_id}>) is no longer streaming...💥`)

      removeCurrentStreamer(member_id)
    }
  })


  print("Listening... ==> ", onlineListener, offlineListener)

  LISTENERS[`${userId}_online_${timestamp}`] = {id: (userId as string), listener: onlineListener, timestamp, key: `${userId}_online_${timestamp}`}
  LISTENERS[`${userId}_offline_${timestamp}`] = {id: (userId as string), listener: offlineListener, timestamp, key: `${userId}_offline_${timestamp}`}
}

client.on("ready", async () => {
  setupStreamListeners()
  // setInterval(setupStreamListeners, 10000)
  // let guild = await client.guilds.fetch(process.env.GUILD_ID)
  // let memberz = await guild.members.fetch()
  // print("We've cached: ", memberz.map(member => (member.nickname || member.displayName)))
})

client.on("presenceUpdate", async (oldPresence, newPresence) => {
  let guild = newPresence.guild
  let member = newPresence.member
  
  if (guild.id != process.env.GUILD_ID) { return }

  let streamingActivity = (newPresence.activities || []).find(activity => activity.type == ActivityType.Streaming)
  
  if (streamingActivity == null) {
    removeCurrentStreamer(member.id)
    return
  }

  // print("streamingActivity: ", streamingActivity)
  // console.log(newPresence.activities)

  channel = await client.channels.fetch(process.env.LIVE_CHANNEL_ID) as TextChannel

  const isYouTube = streamingActivity.name == "YouTube" || (streamingActivity.url.startsWith("https://youtube.com/watch?v=") && !streamingActivity.url.includes("twitch.tv"))
  let twitchUsername = streamingActivity.url.split("/").pop()

  // sendStreamStartedMessage(member.id,
  //   isYouTube ? streamingActivity.url : twitchUsername,
  //   streamingActivity.details,
  //   streamingActivity.assets?.largeImageURL({ size: 1024 }),
  //   streamingActivity.state
  // )

  let youtubeChannelName: string | undefined = undefined
  if (isYouTube) {
    youtubeChannelName = await new Promise((res, rej) => {
      const user_client = new Client()
      user_client.login(process.env["USER_TOKEN"])

      user_client.once("ready", async () => {
        const user = await user_client.users.fetch(member.id)
        const profile = await user.getProfile()
        // print("profile.connected_accounts: ", profile.connected_accounts)
        
        const youtubes = profile.connected_accounts.filter(account => account.type == 'youtube')
        const firstYouTubeAccount = youtubes[0]

        // print("firstYouTubeAccount: ", firstYouTubeAccount)

        user_client.destroy()

        res(firstYouTubeAccount.name)
      })
    })
  }

  sendStreamStartedMessage(member.id, {
    header: isYouTube ? (youtubeChannelName ?? member.user.username) : twitchUsername,
    platform: isYouTube ? "YOUTUBE" : "TWITCH",
    url: streamingActivity.url,
    desc: streamingActivity.details,
    thumbnail: streamingActivity.assets?.largeImageURL({ size: 1024 }),
    footer: streamingActivity.state,
  })
})

interface StreamStartPayload {
  header: string;
  platform: string;
  url: string;
  desc: string;
  thumbnail: string;
  footer: string;
}

interface StreamingPlatform {
  name: string;
  emoji: string;
  color: number;
}

const PLATFORMS: {[key: string]: StreamingPlatform} = {
  TWITCH: {
    name: "Twitch",
    emoji: TWITCH_EMOJI,
    color: 0x6441A4
  },
  YOUTUBE: {
    name: "YouTube",
    emoji: YOUTUBE_EMOJI,
    color: 0xff0000
  },
}

async function sendStreamStartedMessage(memberId: string, payload: StreamStartPayload) {
  if (!CURRENT_STREAMERS.has(memberId)) {
    addCurrentStreamer(memberId)

    const platform = PLATFORMS[payload.platform]
    
    console.log(`${payload.header} (<@${memberId}>) is now streaming!`)
    channel = (await client.channels.fetch(process.env["LIVE_CHANNEL_ID"]) as TextChannel)
    return channel.send({content: `# 🔴 ${(GO_LIVE_MESSAGES.random() as string).replace("%%PLATFORM%%", payload.platform)}`, embeds: [
      {
        title: `${platform.emoji} @${payload.header}`,
        description: `<@${memberId}>: ${payload.desc}`,
        url: payload.url,
        image: {
          url: payload.thumbnail ?? "https://files.planet-bluto.net/placeholder.png",
        },
        color: platform.color,
        footer: {
          text: payload.footer
        }
      }
    ]})
  } else {
    return null
  }
}