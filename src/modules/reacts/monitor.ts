import { Collection, Events, ForumChannel, Message, PartialMessage, Snowflake, TextChannel } from "discord.js"

import TaskManager from "../../lib/taskManager"

import { client } from "../client"
import { REACT_EXP_TYPE_PREFIX, setEXP } from "../levels/api"

import { msgReactsUpdate } from "./updates"
import { MONITORING_CHANNELS, unhighlightMessage } from "./api"
import { ShowcasePostDB } from "./db"
import { handleMessage } from "../reply_thread_channels"


const taskManager = new TaskManager()

client.on(Events.ClientReady, async () => {
  let proms: Promise<Collection<Snowflake, Message> | Message>[] = []
  
  for (const channelId of MONITORING_CHANNELS) {
    print("channelId: ", channelId)

    const channel = (await client.channels.fetch(channelId)) as TextChannel | ForumChannel

    print("channel: ", channel)

    if ((channel as any)?.messages != undefined) {
      proms.push((channel as TextChannel).messages.fetch({ limit: 50 }))
    } else {
      const { threads } = await (channel as ForumChannel).threads.fetch()
      for (const [_threadId, thread] of threads) {
        proms.push(thread.fetchStarterMessage())
      }
    }
  }

  const results = await Promise.all(proms)

  for (const result of results) {
    if (result instanceof Message) { continue } // Skip because it's a forum start message and don't need it

    for (const [_msgId, msg] of result) {
      if (!process.env.REPLY_THREAD_CHANNELS.split(",").includes(msg.channelId)) { continue }
      await handleMessage(msg)
    }
  }
})

client.on(Events.MessageReactionAdd, (reaction) => {
  taskManager.add(msgReactsUpdate.bind(null, reaction.message))
})

client.on(Events.MessageReactionRemove, (reaction) => {
  taskManager.add(msgReactsUpdate.bind(null, reaction.message))
})

client.on(Events.MessageReactionRemoveAll, (message) => {
  taskManager.add(msgReactsUpdate.bind(null, message))
})

client.on(Events.MessageReactionRemoveEmoji, (reaction) => {
  taskManager.add(msgReactsUpdate.bind(null, reaction.message))
})


async function handleMessageDelete(authorId: string, msgId: string) {
  const db = await ShowcasePostDB()
  setEXP(authorId, `${REACT_EXP_TYPE_PREFIX}${msgId}`, 0)
  await unhighlightMessage(db, msgId)
  
  db.data = db.data.filter(entry => entry.post_id != msgId)
  await db.write()
}

client.on(Events.MessageDelete, async (msg) => {
  taskManager.add(handleMessageDelete.bind(null, msg.author.id, msg.id))
})

client.on(Events.MessageBulkDelete, async (msgs) => {
  for (const [msgId, msg] of msgs) { taskManager.add(handleMessageDelete.bind(null, msg.author.id, msgId)) }
})