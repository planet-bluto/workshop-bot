import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedType,
  GuildMember,
  SlashCommandBuilder,
  SlashCommandUserOption
} from "discord.js"

import { client } from "../client"
import { CommandEntry } from "../interactions"

import { getHeatMapData, getWorkTime } from "../work_logging/calc"
import { createEmbedImage } from "../work_logging/embed"

import { getEXP } from "../levels/api"

import { ShowcasePostDB } from '../reacts/db';


export const WorkCardEmbed = async (memberOrId: string | GuildMember) => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID)

  const targetMember = typeof(memberOrId) == "string" ? (await guild.members.fetch(memberOrId)) : memberOrId

  const WorkTime = await getWorkTime(targetMember.id)
  // print(`@${targetMember.username} WorkTime: `, WorkTime)

  const EXP = await getEXP(targetMember.id)
  // const LVL = calcLevel(EXP)
  // const LVLprog = calcLevelProgress(EXP)

  const heatmapData = await getHeatMapData(targetMember.id)
  const heatmap = await createEmbedImage(heatmapData, EXP)

  const post_db = await ShowcasePostDB()
  const member_posts = post_db.data.filter(entry => entry.author_id == targetMember.id)
  const totalReactCount = member_posts.reduce((prev, curr) => prev + curr.reacts, 0)

  // await reply(`Total Hours Logged: \`\`${WorkTime.fancy} (${WorkTime.usd_formatted})\`\``, false)

  const attachment = new AttachmentBuilder(heatmap.buffer)
  .setName("heatmap.png")

  return {
    files: [
      attachment
    ],
    embeds: [
      {
        "color": 0x2765ff,
        "description": `# <:workshop_toolbox:1338226329287524382> <@${targetMember.id}> WORK LOG`,
        "fields": [
            {
                "inline": true,
                "name": "Hours Co-Work'd",
                "value": `\`\`${WorkTime.fancy}\`\``
            },
            {
                "inline": true,
                "name": "Total Reacts Earned!",
                "value": `\`\`${totalReactCount}\`\``
            },
            // {
            //     "inline": true,
            //     "name": "EXP",
            //     "value": `\`\`${EXP.toFixed(2)}wp (Lvl. ${calcLevel(EXP)})\`\``
            // }
        ],
        "image": {
            "description": `${targetMember.user.username}'s Co-Working HoursHeatmap`,
            "height": heatmap.height,
            "url": "attachment://heatmap.png",
            "width": heatmap.width
        },
        "thumbnail": {
            "description": `${targetMember.user.username}'s Profile Picture`,
            "height": 256,
            "url": (targetMember.avatarURL({size: 256}) ?? targetMember.user.avatarURL({size: 256})),
            "width": 256
        },
        "type": EmbedType.Rich
      }
    ]
  }
}

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
      const embedMsgOptions = await WorkCardEmbed(targetUser.id)

      await interaction.editReply(embedMsgOptions)
    }
  ]
] as CommandEntry