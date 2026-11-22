import { GuildEmoji, Message, MessageCreateOptions, TextChannel } from "discord.js"
import { client } from "./client"

client.on("ready", async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  const role = await guild.roles.fetch(process.env.MOD_ROLE_ID)
  
  role.members.forEach(async (member) => {
    const dmChannel = await member.user.createDM()
    
    const collector = dmChannel.createMessageCollector()
    collector.on("collect", handleModDMMessage)
  })
})

let DRAFTING_MODS = new Set<string>()
let AWAITING_CHANNELS = new Set<string>()
let CURRENT_DRAFTS = new Map<string, Message[]>()

let PREVIEW_MESSAGES = new Map<string, Message[]>()

async function deletePreviewMessages(channelId: string) {
  if (!PREVIEW_MESSAGES.has(channelId)) { return }

  // const channel = (await client.channels.fetch(channelId)) as TextChannel

  for (const message of (PREVIEW_MESSAGES.get(channelId) ?? [])) {
    // const message = await channel.messages.fetch(messageId)

    // if (message == undefined) { continue }

    await message.delete()
  }

  PREVIEW_MESSAGES.delete(channelId)
}

const PREVIEW_AUTO_DELETE_TIMEOUT_SECS = 15
async function handleModDMMessage(message: Message) {
  if (AWAITING_CHANNELS.has(message.channel.id)) { return }
  const checkForCommand = (cmd: string) => (message.content.toLowerCase().startsWith("!" + cmd))

  if (!DRAFTING_MODS.has(message.author.id)) { // start drafting, only listen for command if not already drafting...
    if (checkForCommand("start")) {
      // sending this first so toolbox doesn't collect it's own starter message for drafting from bot
      await message.reply(`\`\`\`py\n"Draft started, send messages below to foward to announcements..."\n# Remember, you should probably remove the embeds for links since it'll try to recreate it on repost\n\`\`\``)
      print(`Announcement draft started by @${message.author.username} ...`)
      DRAFTING_MODS.add(message.author.id)
    } 
  } else {
    if (checkForCommand("preview")) {
      AWAITING_CHANNELS.add(message.channelId)

      const header_message = await message.reply(`\`\`\`py\n# Here's a preview of what the announcement would look like forwarded:\n\`\`\``)

      const cached_messages = CURRENT_DRAFTS.get(message.author.id)

      const messages = await forwardDraftsToAnnouncements(cached_messages, message.channelId)

      const footer_message = await (message.channel as TextChannel).send(`\`\`\`py\n# Preview End.\n\`\`\`\n -# Deleting <t:${Math.round(Date.now() / 1000) + PREVIEW_AUTO_DELETE_TIMEOUT_SECS}:R>...`)
      
      PREVIEW_MESSAGES.set(message.channelId, [header_message, ...messages, footer_message])

      AWAITING_CHANNELS.delete(message.channelId)
      
      setTimeout(() => { deletePreviewMessages(message.channelId) }, 1000 * PREVIEW_AUTO_DELETE_TIMEOUT_SECS)

    } else if (checkForCommand("clear_preview")) {
      await deletePreviewMessages(message.channelId)
    } else if (checkForCommand("end") || checkForCommand("cancel")) {
      DRAFTING_MODS.delete(message.author.id)

      if (!CURRENT_DRAFTS.has(message.author.id)) { return }

      const cached_messages = CURRENT_DRAFTS.get(message.author.id)
      CURRENT_DRAFTS.delete(message.author.id)

      if (checkForCommand("cancel")) {
        print(`@${message.author.username} announcement draft cancelled!`)
        await message.reply("```diff\n- Draft cancelled, type !start to try again...\n```")
        return
      }

      const messages = await forwardDraftsToAnnouncements(cached_messages)

      if (messages.length > 0) {
        await message.reply(`\`\`\`diff\n+ Announcement published!\n\`\`\`\nSee here: ${messages[0].url}`)
      } else {
        await message.reply(`\`\`\`py\n# Sent... nothing?...\n\`\`\``)
      }
    } else {
      collectMessageForDraft(message)
    }
  }
}

async function collectMessageForDraft(message: Message) {
  print("Collected message for announcement draft ...")
  const author_id = message.author.id
  if (!CURRENT_DRAFTS.has(author_id)) { CURRENT_DRAFTS.set(author_id, []) }

  // if (message.author.id == client.user.id) { await message.suppressEmbeds() }

  CURRENT_DRAFTS.get(author_id).push(message)
}

// type MessagePayload = {
//   content: string;
//   poll: any; // ??...
// }

async function forwardDraftsToAnnouncements(messages: Message[], target_channel: string = process.env.ANNOUNCEMENT_CHANNEL_ID): Promise<Message[]> {
  print("Draft finished, forwarding ...")
  const pendingMessagePayloads: MessageCreateOptions[] = []

  for (const cached_message of messages) {
    let message: Message
    try {
      message = await cached_message.fetch(true)
    } catch(err) {
      continue
    }

    pendingMessagePayloads.push({
      content: message.content,
      files: message.attachments.toJSON(),
      poll: (message.poll == undefined ? undefined : {
        allowMultiselect: message.poll.allowMultiselect,
        answers: message.poll.answers.toJSON().map(answer => ({ emoji: answer.emoji.toString(), text: answer.text })),
        duration: Math.round((message.poll.expiresAt.valueOf() - Date.now()) / 3600000),
        layoutType: message.poll.layoutType,
        question: message.poll.question
      }),
      embeds: message.embeds
    })
  }

  const announcementsChannel  = (await client.channels.fetch(target_channel)) as TextChannel

  let sentMessages: Message[] = []

  for (const messagePayload of pendingMessagePayloads) {
    print("Sending message to announcements...", messagePayload)
    const msg = await announcementsChannel.send(messagePayload)
    sentMessages.push(msg)
  }

  print(`Announcement draft published to announcement channel!`)

  return sentMessages
}