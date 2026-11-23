import { ButtonStyle, ChatInputCommandInteraction, ComponentType, InteractionContextType, MessageFlags, PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder } from "discord.js"

import { getTimeblockInfo, TIMEBLOCKS, WEEKDAYS } from "./base"
import { CommandEntry } from "../interactions"

const CMD_NAME = "timeblock_channel_setup"

export default [
  CMD_NAME,
  [
    new SlashCommandBuilder()
    .setName(CMD_NAME)
    .setDescription("Sets up Timeblock Channel (Admin Only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),
    

    async (interaction: ChatInputCommandInteraction) => {
      const reply = (content: string, ephemeral: boolean = false) => ((interaction.replied || interaction.deferred) ? interaction.editReply({
        content,
      }) : interaction.reply({
        content,
        ...(!ephemeral && { flags: MessageFlags.Ephemeral }),
      }))

      const isMod = (interaction.member.permissions as PermissionsBitField).has(PermissionFlagsBits.Administrator)

      if (!isMod) {
        await reply("**You must be an administrator to execute this command!**")
        return
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      const dayButtonFunction = (day: string, timeblock: string, label: string = day): any => ({
        type: ComponentType.Button,
        custom_id: "TIMEBLOCK_" + day + "_" + timeblock,
        style: day.startsWith("ALL.") ? day.endsWith("ADD") ? ButtonStyle.Success : ButtonStyle.Danger : ButtonStyle.Primary,
        label: label
      })

      for (const timeblock of TIMEBLOCKS) {
        print("timeblock: ", timeblock)

        const { startTimeSec, endTimeSec } = getTimeblockInfo(timeblock)
        

        await interaction.channel.send({
          content: `# ${timeblock} BLOCK (<t:${startTimeSec}:t> - <t:${endTimeSec}:t>)`,
          components: [
            {
              type: ComponentType.ActionRow,
              components: WEEKDAYS.slice(0, 5).map(day => dayButtonFunction(day, timeblock))
            },
            {
              type: ComponentType.ActionRow,
              components: [...WEEKDAYS.slice(5).map(day => ([day, timeblock])), ["ALL.ADD", timeblock, "+ ALL"], ["ALL.REMOVE", timeblock, "- ALL"]].map((args: [string, string?]) => dayButtonFunction(...args))
            }
          ]
        })
      }

      await interaction.channel.send({
        content: `### Clear All Timeblock Roles`,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [dayButtonFunction("ALL.REMOVE", "ALL", "Clear All!")]
          }
        ]
      })

      await reply("Should be done...")
    }
  ]
] as CommandEntry