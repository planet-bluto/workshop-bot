import { BaseChannel, ChannelType, ChatInputCommandInteraction, GuildEmoji, InteractionContextType, InteractionResponse, Message, MessageCreateOptions, MessageFlags, PermissionFlagsBits, PermissionsBitField, PrivateThreadChannel, SlashCommandBuilder, SlashCommandChannelOption, TextChannel, ThreadChannel } from "discord.js"
import { client } from "./client"
import { CommandEntry } from "./interactions"
import { DateTime } from "luxon"

const CMD_NAME = "draft_announcement"
const PREVIEW_AUTO_DELETE_TIMEOUT_SECS = 15

export default [
  CMD_NAME,
  [
    new SlashCommandBuilder()
    .setName(CMD_NAME)
    .setDescription("Starts an announcement draft! (Admin Only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

    async (interaction: ChatInputCommandInteraction) => {
      let deferred = false

      const reply = (content: string) => (deferred ? interaction.editReply({
        content,
      }) : interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
      }))

      const isMod = (interaction.member.permissions as PermissionsBitField).has(PermissionFlagsBits.Administrator)

      if (!isMod) {
        await reply("**You must be an administrator to execute this command!**")
        return
      }

      if (interaction.channelId != process.env.ANNOUNECMENT_DRAFT_CHANNEL_ID) {
        await reply(`**You have to use this in <#${process.env.ANNOUNECMENT_DRAFT_CHANNEL_ID}>!**`)
        return
      }

      await interaction.deferReply()
      deferred = true

      // const msg = await interaction.fetchReply("@original")

      const threadChannel = (await (interaction.channel as TextChannel).threads.create({
        name: `Announcement Draft - ${DateTime.now().toFormat("DD")}`,
        invitable: false
      })) as PrivateThreadChannel

      await threadChannel.members.add(interaction.user.id)
      
      // const threadChannel = await msg.startThread({
      //   name: `Announcement Draft - ${DateTime.now().toFormat("DD")}`,
      // })

      // const collector = threadChannel.createMessageCollector()
      // collector.on("collect", monitorForCommands)

      await reply("### ✅ Draft thread started!\n-# Type all the messages of your announcement in here, **remember to mention all the roles you want pinged for the announcement within your messages!!**")
    }
  ]
] as CommandEntry

type ReplyFunc = (content: string) => Promise<Message> | Promise<InteractionResponse>
function innerThreadCommand(cmd_name: string, cmd_desc: string, func: (interaction: ChatInputCommandInteraction, reply?: ReplyFunc) => void) {
  let baseSlashCommand = new SlashCommandBuilder()
    .setName(cmd_name)
    .setDescription(cmd_desc)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)

  if (cmd_name == "publish_announcement") {
    baseSlashCommand.addChannelOption(new SlashCommandChannelOption()
      .setName("target_channel")
      .setRequired(false)
      .setDescription("Channel to actually publish draft to, defaults to main announcements channel")
      .addChannelTypes(ChannelType.AnnouncementThread, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildForum, ChannelType.GuildStageVoice)
    )
  }
  return [
    cmd_name,
    [
      baseSlashCommand,
      async (interaction: ChatInputCommandInteraction) => {
        let deferred = false

        const reply = (content: string) => (deferred ? interaction.editReply({
          content,
        }) : interaction.reply({
          content,
          flags: MessageFlags.Ephemeral
        }))



        if ((interaction.channel as ThreadChannel).parentId != process.env.ANNOUNECMENT_DRAFT_CHANNEL_ID) {
          await reply(`**You have to use this in an announcement draft thread inside of <#${process.env.ANNOUNECMENT_DRAFT_CHANNEL_ID}>!**`)
          return
        }

        await interaction.deferReply()
        deferred = true

        await func(interaction, reply)
      }
    ]
  ] as CommandEntry
}

// let AWAITING_CHANNELS = new Set<string>()
let SYSTEM_MESSAGES = new Map<string, string[]>()

async function deletePreviewMessages(channelId: string) {
  if (!SYSTEM_MESSAGES.has(channelId)) { return }

  const channel = (await client.channels.fetch(channelId)) as TextChannel

  for (const messageId of (SYSTEM_MESSAGES.get(channelId) ?? [])) {
    const message = await channel.messages.fetch(messageId)

    untrackSysMessage(channelId, messageId)

    if (message == undefined) { continue }
    await message.delete()
  }
}

function trackSysMessage(chlId: string, ...msgIds: string[]) {
  if (!SYSTEM_MESSAGES.has(chlId)) { SYSTEM_MESSAGES.set(chlId, []) }
  SYSTEM_MESSAGES.get(chlId).push(...msgIds)
}
function untrackSysMessage(chlId: string, ...msgId: string[]) {
  if (!SYSTEM_MESSAGES.has(chlId)) { return }

  SYSTEM_MESSAGES.set(chlId, (SYSTEM_MESSAGES.get(chlId) ?? []).filter(this_msgId => msgId.includes(this_msgId)))
  
  if (SYSTEM_MESSAGES.get(chlId).length == 0) {
    SYSTEM_MESSAGES.delete(chlId)
  }
}

export const previewCommand = innerThreadCommand("preview_announcement", "Preview draft inside thread before publishing", async (interaction: ChatInputCommandInteraction, reply: ReplyFunc) => {
  // trackSysMessage(interaction.channelId, interaction.id)

  const header_message = await interaction.editReply(`\`\`\`py\n# Here's a preview of what the announcement would look like forwarded:\n\`\`\``)
  trackSysMessage(interaction.channelId, header_message.id)

  const messages = await forwardDraftsToAnnouncements(interaction.channelId, interaction.channelId)
  trackSysMessage(interaction.channelId, ...messages.map(msg => msg.id))

  const footer_message = await (interaction.channel as TextChannel).send(`\`\`\`py\n# Preview End.\n\`\`\`\n -# Deleting <t:${Math.round(Date.now() / 1000) + PREVIEW_AUTO_DELETE_TIMEOUT_SECS}:R>...`)
  trackSysMessage(interaction.channelId, footer_message.id)

  // SYSTEM_MESSAGES.set(message.channelId, [])
  // message, header_message, ...messages, footer_message

  // AWAITING_CHANNELS.delete(message.channelId)

  setTimeout(() => { deletePreviewMessages(interaction.channelId) }, 1000 * PREVIEW_AUTO_DELETE_TIMEOUT_SECS)
})

export const publishCommand = innerThreadCommand("publish_announcement", "Publish announcement to announcements OR specified channel", async (interaction: ChatInputCommandInteraction) => {
  const targetChannel = interaction.options.getChannel("target_channel", false)
  print("targetChannel: ", targetChannel)
  const TARGET_CHANNEL_ID = (targetChannel?.id ?? process.env.ANNOUNCEMENT_CHANNEL_ID)

  const prevReply = await interaction.fetchReply()
  trackSysMessage(interaction.channelId, prevReply.id)
  
  const sentMessages = await forwardDraftsToAnnouncements(interaction.channelId, TARGET_CHANNEL_ID)
  if (sentMessages.length == 0) { return }

  await interaction.editReply(`-# <@${interaction.user.id}>\n# ✅ Announcement Sent!\n-# See here: ${sentMessages[0].url}`)

  untrackSysMessage(interaction.channelId, prevReply.id)
})

async function forwardDraftsToAnnouncements(reading_draft_thread_id: string, target_channel: string = process.env.ANNOUNCEMENT_CHANNEL_ID): Promise<Message[]> {
  print("Draft finished, forwarding ...")
  const pendingMessagePayloads: MessageCreateOptions[] = []

  const draft_thread = (await client.channels.fetch(reading_draft_thread_id)) as ThreadChannel
  const messages = (await draft_thread.messages.fetch({
    limit: 100
  })).toJSON().filter(msg => !(SYSTEM_MESSAGES.get(reading_draft_thread_id) ?? []).includes(msg.id)).reverse()

  // Should be the OP message, none of that...
  messages.shift()

  print("messages: ", messages)

  // if (true) { return [] }

  for (const message of messages) {
    // let message: Message
    // try {
    //   message = await cached_message.fetch(true)
    // } catch(err) {
    //   continue
    // }

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
      embeds: (message.author.bot ? message.embeds : [])
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