import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandRoleOption } from "discord.js"
import { client } from "../client"
import { CommandEntry } from "../interactions"
import { calcLevel, getLeaderboard } from "../levels/api"
import { getTotalReactCount } from "../reacts/api"
import { ShowcasePostDB } from "../reacts/db"
import { getWorkTime } from "../work_logging/calc"

async function LeaderboardEmbed(options: { range?: [number, number?] } = {}) {
  const leaderboard = await getLeaderboard({ ...options })

  const top3members = leaderboard.slice(0, Math.min(leaderboard.length, 3))
  const top3decor: {label: string, color: string, emoji: string}[] = [
    {label: "1ST", color: "#ffbf00", emoji: "🥇"},
    {label: "2ND", color: "#d3d3d3", emoji: "🥈"},
    {label: "3RD", color: "#92420d", emoji: "🥉"},
  ]

  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  
  const expToDecor = {}
  const embed_proms = top3members.map(async entry => {
    let decor: {label: string, color: string, emoji: string}
    if (expToDecor[String(entry.exp)] == undefined) {
      decor = top3decor.shift()
      expToDecor[String(entry.exp)] = decor
    } else {
      decor = expToDecor[String(entry.exp)]
    }

    // print("decor: ", decor)

    const user = await client.users.fetch(entry.member_id)

    const workTime = await getWorkTime(entry.member_id)
    const totalReactCount = await getTotalReactCount(entry.member_id)

    return {
      "description": [
        `# ${decor.emoji} \`\`${decor.label}\`\` <@${entry.member_id}>`,
        `-# **Lvl. ${calcLevel(entry.exp ?? 0)} - \`\`${entry.exp.toFixed(2)}\`\`** | **Hours:** \`\`${workTime.fancy}\`\` | **Reacts:** \`\`${totalReactCount}\`\``
      ].join("\n"),
      "color": Number("0x" + decor.color.replace("#", "")),
      "thumbnail": {
        "url": (user.avatarURL({size: 256}))
      }
    }
  })

  const embeds = await Promise.all(embed_proms)

  return {
    "content": "# 🏆 ALL-TIME LEADERBOARD 🏆",
    "flags": 0,
    "embeds": embeds
  }
}


export const LeaderboardCommand: CommandEntry = [
  "leaderboard",
  [
    new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Shows the work points leaderboard!")
    ,

    async (interaction: ChatInputCommandInteraction) => {
      // const reply = (content: string, ephemeral: boolean = false) => ((interaction.replied || interaction.deferred) ? interaction.editReply({
      //   content,
      // }) : interaction.reply({
      //   content,
      //   ...(!ephemeral && { flags: MessageFlags.Ephemeral }),
      // }))

      await interaction.deferReply()

      const embedMsgOptions = await LeaderboardEmbed()

      await interaction.editReply(embedMsgOptions)
    }
  ]
] as CommandEntry