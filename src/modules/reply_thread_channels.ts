import { Events, Message, TextChannel } from "discord.js"
import { DateTime } from "luxon"

import { client } from "./client"

const reply_thread_channels = new Set<TextChannel>()

client.on(Events.ClientReady, async () => {
  const reply_thread_channels_ids = process.env.REPLY_THREAD_CHANNELS.split(",")
  
  for (const reply_thread_channels_id of reply_thread_channels_ids) {
    const channel = await client.channels.fetch(reply_thread_channels_id)
    
    if (channel == undefined || !channel.isTextBased()) { continue }

    reply_thread_channels.add(channel as TextChannel);

    const collector = (channel as TextChannel).createMessageCollector()
    collector.on("collect", handleMessage)
  }
})

export async function handleMessage(message: Message) {
  if (message.author.id == client.user.id) { return }

  let proms = []

  if (!message.hasThread) {
    proms.push(
      message.startThread({
        name: `@${message.author.username} - ${message.cleanContent.length == 0 ? `${message.cleanContent.split("\n")[0].slice(0, 30)} - ` : ''}${DateTime.fromMillis(message.createdTimestamp).toLocaleString(DateTime.DATE_MED)}`
      })
    )
  }

  proms.push(
    message.react("🔥"),
    message.react(process.env.BLUE_FIRE_EMOJI_ID)
  )

  await Promise.all(proms)
}