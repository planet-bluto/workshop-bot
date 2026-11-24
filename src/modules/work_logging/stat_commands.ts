import { AttachmentBuilder, ChatInputCommandInteraction, EmbedType, MessageFlags, SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandUserOption } from "discord.js"
// import { colord } from "colord"

import { CommandEntry } from "../interactions"
import { getHeatMapData, getWorkTime } from "./calc"
import { generateGrid } from "./embed"


export const WorkLogCommand: CommandEntry = [
  "worklog",
  [
    new SlashCommandBuilder()
    .setName("worklog")
    .setDescription("Shows you your work log!")
    .addUserOption(
      new SlashCommandUserOption()
      .setRequired(false)
      .setName("user")
      .setDescription("User who's stats will be shown, leave blank for your own")
    )
    ,

    async (interaction: ChatInputCommandInteraction) => {
      // const reply = (content: string, ephemeral: boolean = false) => ((interaction.replied || interaction.deferred) ? interaction.editReply({
      //   content,
      // }) : interaction.reply({
      //   content,
      //   ...(!ephemeral && { flags: MessageFlags.Ephemeral }),
      // }))

      await interaction.deferReply()

      const targetUser = (interaction.options.getUser("user") ?? interaction.user)

      const WorkTime = await getWorkTime(targetUser.id)
      print(`@${targetUser.username} WorkTime: `, WorkTime)

      const heatmapData = await getHeatMapData(targetUser.id)
      const heatmap = await generateGrid(heatmapData)

      // await reply(`Total Hours Logged: \`\`${WorkTime.fancy} (${WorkTime.usd_formatted})\`\``, false)

      const attachment = new AttachmentBuilder(heatmap.buffer)
      .setName("heatmap.png")

      await interaction.editReply({
        files: [
          attachment
        ],
        embeds: [
          {
            "color": 0x2765ff,
            "description": `# <:workshop_toolbox:1338226329287524382> <@${targetUser.id}> WORK LOG`,
            "fields": [
                {
                    "inline": true,
                    "name": "Hours Co-Work'd",
                    "value": `\`\`${WorkTime.fancy}\`\``
                },
                {
                    "inline": true,
                    "name": "Earnings",
                    "value": `\`\`${WorkTime.in_hours}\`\``
                }
            ],
            "image": {
                "description": `${targetUser.username}'s Co-Working HoursHeatmap`,
                "height": heatmap.height,
                "url": "attachment://heatmap.png",
                "width": heatmap.width
            },
            "thumbnail": {
                "description": `${targetUser.username}'s Profile Picture`,
                "height": 256,
                "url": targetUser.avatarURL({size: 256}),
                "width": 256
            },
            "type": EmbedType.Rich
          }
        ]
      })
    }
  ]
] as CommandEntry