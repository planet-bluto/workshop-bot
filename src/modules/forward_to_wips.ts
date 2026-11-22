import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageContextMenuCommandInteraction, MessageFlags, TextChannel, ThreadChannel } from "discord.js";
import { CommandEntry } from "./interactions";
import { client } from "./client";

const CMD_NAME = 'Forward to WIPs Channel'

let USER_FORWARD_TIMES = new Map<string, number>()

client.on("threadCreate", async (thread, newlyCreated) => {
  print("newlyCreated (idk what this means): ", newlyCreated)
  if (!newlyCreated) { return }
  
  if (thread.parentId == process.env.PROJECTS_CHANNEL_ID) {
    const msg = await thread.send({content: `<@${thread.ownerId}> **Remember, you can forward pivotal progress points directly to <#${process.env.WIPS_CHANNEL_ID}> that links back to here**\n-# **This message will delete after you send another message...** (or it might stay here if the bot crashes LMAO- ping blu if that happens)`})
    const collector = thread.createMessageCollector({max: 1})
    collector.on("collect", async () => {
      await msg.delete()
      collector.stop("Did what it needed to do.")
    })
  }
})

export default [
  CMD_NAME,
  [
    new ContextMenuCommandBuilder()
    .setName(CMD_NAME)
    .setType(ApplicationCommandType.Message)
    .setContexts(InteractionContextType.Guild),

    async (interaction: MessageContextMenuCommandInteraction) => {
      
      const reply = (content: string, success: boolean = false) => interaction.reply({
        content,
        ...(!success && { flags: MessageFlags.Ephemeral }),
      })

      if (interaction.user.id != (interaction.targetMessage.channel as ThreadChannel).ownerId) {
        await reply("⚠ **You can only forward your messages if you are the OP!**")
        return
      }

      if (interaction.user.id != interaction.targetMessage.author.id) {
        await reply("⚠ **You can only forward your own messages!**")
        return
      }

      const last_forwarded_time = USER_FORWARD_TIMES.get(interaction.user.id)
      if (last_forwarded_time != undefined && (Date.now() - last_forwarded_time) < (3600000 * 6)) {
        await reply("⚠ **You must wait 6 hours before using this feature again!**")
        return
      }

      const wipsChannel = (await client.channels.fetch(process.env.WIPS_CHANNEL_ID)) as TextChannel | undefined
      if (wipsChannel == undefined) {
        await reply(`❌ **Error forwarding :(**\n\`\`\`py\n# Couldn't fetch wips channel...\n\`\`\``)
        return
      }
      
      const forwardedMsg = await interaction.targetMessage.forward(wipsChannel)
      await wipsChannel.send({content: `## ⤵️  <@${interaction.user.id}>  ➡️  ${interaction.targetMessage.url}`})
      
      USER_FORWARD_TIMES.set(interaction.user.id, Date.now())
      
      await reply(`✅ **Forwarded to wips! ${forwardedMsg.url}**`, true)
      return
    }
  ]
] as CommandEntry