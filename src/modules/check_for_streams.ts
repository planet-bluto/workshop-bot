import { ActivityType, Guild, TextChannel } from "discord.js"
import { client } from "./client"

import { Client } from "discord.js-selfbot-v13"

import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient, UserIdResolvable } from "@twurple/api";
import { wait } from "./wait";
import { EventSubMiddleware } from "@twurple/eventsub-http";
import { app, ExpressEvents } from "./express";

const authProvider = new AppTokenAuthProvider(process.env["TWITCH_CLIENT_ID"], process.env["TWITCH_CLIENT_SECRET"]);
const apiClient = new ApiClient({ authProvider })
const twitchListener = new EventSubMiddleware({
  apiClient,
  hostName: process.env["HOSTNAME"],
  pathPrefix: '/twitch',
  secret: process.env["SECRET"]
});

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
  "LIVE ON TWITCH!!",
  "WATCH NOW!!",
  "LIVE STREAM!!",
  "LIVE ON AIR!!",
  "TUNE IN!!",
  "GOING LIVE!!"
]

let LISTENERS: any = {}
let DiscordTwitchConnections: any = {}
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

      let listenerEntries: any[] = Object.values(LISTENERS)
      listenerEntries.filter(entry => entry.timestamp != timestamp).forEach(entry => {
        twitchListener.removeListener(entry.listener)
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
const LISTENING_STREAMS = new Set<string>()

async function listenForStream(userId: UserIdResolvable, timestamp: number) {
  if (LISTENING_STREAMS.has(userId as string)) { return }
  LISTENING_STREAMS.add(userId as string)

  let member_id = DiscordTwitchConnections[userId as string]

  let listenerEntries: any[] = (Object.values(LISTENERS) as any[]).filter(entry => entry.id == userId)
  if (listenerEntries.length == 0) {
    apiClient.streams.getStreamByUserId(userId).then(stream => {
      if (stream != null) {
        sendStreamStartedMessage(member_id,
          stream.userName,
          stream.title,
          stream.getThumbnailUrl(1820, 1024),
          stream.gameName
        )
      }
    })
  } else {
    listenerEntries.forEach(entry => {
      twitchListener.removeListener(entry.listener)
      delete LISTENERS[entry.key]
    })
  }
  
  let onlineListener = null
  while (onlineListener == null) {
    onlineListener = twitchListener.onStreamOnline(userId, async (event) => {
      print(`verifying stream... ${userId}|${event.broadcasterName}`)
      let guild = await client.guilds.fetch(process.env["GUILD_ID"])
      let member = await guild.members.fetch(member_id)
  
      let stream = null
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
  
      sendStreamStartedMessage(member.id,
        stream.userName,
        stream.title,
        stream.getThumbnailUrl(1820, 1024),
        stream.gameName
      )
    })
  }

  let offlineListener = null
  while (offlineListener == null) {
    offlineListener = twitchListener.onStreamOffline(userId, async (event) => {
      let member_id = DiscordTwitchConnections[userId as string]

      print(`verifying offline... ${userId}|${event.broadcasterName}`)
      if (CURRENT_STREAMERS.has(member_id)) {
        console.log(`${event.broadcasterName} (<@${member_id}>) is no longer streaming...💥`)

        CURRENT_STREAMERS.delete(member_id)
      }
    })
  }

  // print("Listening... ==> ", onlineListener, offlineListener)

  LISTENERS[`${userId}_online_${timestamp}`] = {id: userId, lisetner: onlineListener, timestamp, key: `${userId}_online_${timestamp}`}
  LISTENERS[`${userId}_offline_${timestamp}`] = {id: userId, lisetner: offlineListener, timestamp, key: `${userId}_offline_${timestamp}`}
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

  // print("Activities: ", newPresence.activities)

  let streamingActivity = (newPresence.activities || []).find(activity => activity.type == ActivityType.Streaming)
  
  if (streamingActivity != null) {
    // console.log(newPresence.activities)

    if (channel == null) {
      channel = await client.channels.fetch(process.env.LIVE_CHANNEL_ID) as TextChannel
    }

    client.channels.fetch(process.env.LIVE_CHANNEL_ID).then((channel: TextChannel) => {
      let twitchUsername = streamingActivity.url.split("/").pop()

      sendStreamStartedMessage(member.id,
        twitchUsername,
        streamingActivity.details,
        streamingActivity.assets?.largeImageURL({ size: 1024 }),
        streamingActivity.state
      )
    })
  }
})

async function sendStreamStartedMessage(memberId, twitchUsername, streamDesc, thumbnailUrl, game) {
  if (!CURRENT_STREAMERS.has(memberId)) {
    CURRENT_STREAMERS.add(memberId)
    
    console.log(`${twitchUsername} (<@${memberId}>) is now streaming!`)
    channel = (await client.channels.fetch(process.env["LIVE_CHANNEL_ID"]) as TextChannel)
    return channel.send({content: `# 🔴 ${GO_LIVE_MESSAGES.random()}`, embeds: [
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
    ]})
  } else {
    return null
  }
}