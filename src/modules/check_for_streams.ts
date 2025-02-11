import { ActivityType, Guild, TextChannel } from "discord.js"
import { client } from "./client"

let guild: Guild
let channel: TextChannel
let currentStreamers = new Set<string>()

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

client.on("presenceUpdate", async (oldPresence, newPresence) => {
  let guild = newPresence.guild
  let member = newPresence.member
  
  if (guild.id != process.env.GUILD_ID) { return }

  // print("Activities: ", newPresence.activities)

  let streamingActivity = (newPresence.activities || []).find(activity => activity.type == ActivityType.Streaming)
  
  if (streamingActivity != null) {
    // console.log(newPresence.activities)

    if (!currentStreamers.has(member.id)) {
      console.log(`${member.user.username} is now streaming!`)
      if (channel == null) {
        channel = await client.channels.fetch(process.env.LIVE_CHANNEL_ID) as TextChannel
      }

      guild.channels.fetch(process.env.LIVE_CHANNEL_ID).then((channel: TextChannel) => {
        let twitchUsername = streamingActivity.url.split("/").pop()
        channel.send({content: `# 🔴 ${GO_LIVE_MESSAGES.random()}`, embeds: [
          {
            title: `<:twitch:1329250863692124160> __@${twitchUsername}__`,
            description: `<@${member.id}>: ${streamingActivity.details}`,
            url: streamingActivity.url,
            image: {
              url: streamingActivity.assets?.largeImageURL({ size: 1024 }),
            },
            color: 0x6441A4,
            footer: {
              text: streamingActivity.state
            }
          }
        ]})
      })
    }

    currentStreamers.add(member.id)
  } else {
    // console.log(`${member.user.username} is not streaming.`)
    currentStreamers.delete(member.id)
  }
})