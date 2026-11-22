import { ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, Events, GuildMember, GuildMemberRoleManager, MessageFlags, PermissionFlagsBits, PermissionsBitField, Role, SlashCommandBuilder, VoiceChannel } from "discord.js"
import { CommandEntry } from "./interactions"
import { DateTime, Duration } from "luxon"
import { client } from "./client"
import schedule from "node-schedule"
import path from "path"

const CMD_NAME = "timeblock_channel_setup"

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
const TIMEBLOCKS = ["A", "B", "C", "D", "E", "F"]

const TIMEBLOCK_HOUR_LENGTH = 24 / TIMEBLOCKS.length
const TIMEBLOCK_DURATION = (86400000 / TIMEBLOCKS.length)

const UTC_START_HOUR = 5

export const secTimestamp = (ms_timestamp: number) => Math.round(ms_timestamp / 1000)

const rule = new schedule.RecurrenceRule();
rule.minute = 0;
rule.tz = 'Etc/UTC';

const job = schedule.scheduleJob(rule, hourlyPingCheck);

const getTimeblockInfo = (timeblock: string) => {
  const idx = TIMEBLOCKS.indexOf(timeblock);

  const date = new Date()
  const utcArgs: [number, number, number, number, number, number] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), UTC_START_HOUR, 0, 0]
  const utc = DateTime.utc(...utcArgs)
  print("utcArgs: ", utcArgs, utc.toString())

  const utcTimestamp = (offset: number) => (utc.valueOf() + (TIMEBLOCK_DURATION * offset))

  return {
    startTime: utcTimestamp(idx),
    endTime: utcTimestamp(idx + 1),
    startTimeSec: secTimestamp(utcTimestamp(idx)),
    endTimeSec: secTimestamp(utcTimestamp(idx + 1))
  }
}

import { JSONFilePreset } from 'lowdb/node'

type TimeblockRoleMapData = {
  [timeblock_id: string]: string
}
const fetchDB = async () => {
  const defaultData: TimeblockRoleMapData = {}
  return JSONFilePreset(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'timeblock_role_map.json'), defaultData)
}

client.on(Events.InteractionCreate, async (raw_interaction) => {
  if (!raw_interaction.isButton()) { return }

  const interaction = raw_interaction as ButtonInteraction

  const reply = (content: string, ephemeral: boolean = false) => ((interaction.replied || interaction.deferred) ? interaction.editReply({
    content,
  }) : interaction.reply({
    content,
    ...(!ephemeral && { flags: MessageFlags.Ephemeral }),
  }))
  
  if (!interaction.customId.startsWith("TIMEBLOCK_")) {
    await reply("Error, invalid customId")
    return
  }

  const customIdBits = interaction.customId.split("_")
  
  if (customIdBits.length != 3) {
    await reply("Error, invalid customIdBits length")
    return
  }
  
  const day = customIdBits[1]
  const timeblock = customIdBits[2]
  const timeblockId = `${customIdBits[1]}_${customIdBits[2]}`
  const roleName = `${day} - ${timeblock} BLOCK`

  const db = await fetchDB()
  
  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  
  let pending_role: Role | null = db.data[timeblockId] ? await guild.roles.fetch(db.data[timeblockId]) : null

  const createRole = async () => {
    pending_role = await guild.roles.create({
      name: roleName
    })

    if (pending_role == null || pending_role == undefined) { return }

    db.data[timeblockId] = pending_role.id

    await db.write()
  }
  // Create role if map is missing
  if (db.data[timeblockId] == undefined || pending_role == null) { await createRole() }

  if (pending_role == null) {
    await reply("Error, couldn't find or create timeblock role")
    return
  }

  const member_refetched = await (interaction.member as GuildMember).fetch(true)
  const hasRole = (member_refetched.roles as GuildMemberRoleManager).cache.has(pending_role.id)
  
  await member_refetched.roles[hasRole ? 'remove' : 'add'](pending_role.id)

  await reply(`✅ **${hasRole ? `Removed ${roleName} role` : `Added ${roleName} role`}**`)
})

export default [
  CMD_NAME,
  [
    new SlashCommandBuilder()
    .setName(CMD_NAME)
    .setDescription("Sets up Timeblock Channel (Admin Only!)"),

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

      for (const timeblock of TIMEBLOCKS) {
        const dayButtonFunction = (day: string): any => ({
          type: ComponentType.Button,
          custom_id: "TIMEBLOCK_" + day + "_" + timeblock,
          style: ButtonStyle.Primary,
          label: day
        })
        print("timeblock: ", timeblock)

        const { startTimeSec, endTimeSec } = getTimeblockInfo(timeblock)
        

        await interaction.channel.send({
          content: `# ${timeblock} BLOCK (<t:${startTimeSec}:t> - <t:${endTimeSec}:t>)`,
          components: [
            {
              type: ComponentType.ActionRow,
              components: WEEKDAYS.slice(0, 5).map(dayButtonFunction)
            },
            {
              type: ComponentType.ActionRow,
              components: WEEKDAYS.slice(5).map(dayButtonFunction)
            }
          ]
        })
      }

      await reply("Should be done...")
    }
  ]
] as CommandEntry

// client.on(Events.MessageCreate, async (msg) => {
//   if (msg.content.startsWith("!pingchecktest")) { hourlyPingCheck() }
// })

const modulo = (n, d) => ((n % d) + d) % d

async function hourlyPingCheck() {
  const currentDate = DateTime.now().minus(Duration.fromObject({hour: UTC_START_HOUR})).toJSDate()
  const prev_currentDate = DateTime.now().minus(Duration.fromObject({hour: 4 + UTC_START_HOUR})).toJSDate()
  print("prev_currentDate.toString(): ", prev_currentDate.toString())
  
  const utc_hours = currentDate.getUTCHours()
  const prev_utc_hours = prev_currentDate.getUTCHours()
  // const utc_hours_offset = modulo(utc_hours - UTC_START_HOUR, 24)
  // const utc_prev_hours_offset = modulo(prev_utc_hours - UTC_START_HOUR, 24)
  
  const utc_day = currentDate.getUTCDay()
  const prev_utc_day = prev_currentDate.getUTCDay()
  const utc_day_offset = modulo((utc_day - 1), 7)
  const utc_prev_day_offset = modulo((prev_utc_day - 1), 7)

  print("prev_utc_hours: ", prev_utc_hours)
  // print("utc_prev_hours_offset: ", utc_prev_hours_offset)

  // Only every 4th hour
  if (utc_hours % TIMEBLOCK_HOUR_LENGTH != 0) { return }

  const timeblock_idx = Math.floor(utc_hours / TIMEBLOCK_HOUR_LENGTH)
  const prev_timeblock_idx = Math.floor(prev_utc_hours / TIMEBLOCK_HOUR_LENGTH)

  print("timeblock_idx: ", timeblock_idx)
  print("prev_timeblock_idx: ", prev_timeblock_idx)
  
  const day = WEEKDAYS[utc_day_offset]
  const prev_day = WEEKDAYS[utc_prev_day_offset]
  const timeblock = TIMEBLOCKS[timeblock_idx]
  const prev_timeblock = TIMEBLOCKS[prev_timeblock_idx]
  const timeblockId = `${day}_${timeblock}`
  const prev_timeblockId = `${prev_day}_${prev_timeblock}`
  
  print("timeblockId: ", timeblockId)
  print("prev_timeblockId: ", prev_timeblockId)

  const db = await fetchDB()

  const pending_roleId = db.data[timeblockId]
  const prev_pending_roleId = db.data[prev_timeblockId]

  if (pending_roleId == undefined && prev_timeblockId == undefined) { print(`Would fire ping for ${timeblockId}, but no roles found`); return }

  const coworkingChannel = (await client.channels.fetch(process.env.COWORKING_VOICE_ID)) as VoiceChannel | undefined

  if (coworkingChannel == undefined) { print(`Would fire ping for ${timeblockId}, but voice channel not found`); return }

  const pending_role = coworkingChannel.guild.roles.cache.get(pending_roleId)
  print("pending_role: ", pending_role)
  const prev_pending_role = coworkingChannel.guild.roles.cache.get(prev_pending_roleId)
  print("prev_pending_role: ", pending_role)
  
  const currentValid = (pending_role?.members?.size ?? 0) > 0
  const prevValid = (prev_pending_role?.members?.size ?? 0) > 0

  const lines = [
    `# :briefcase:  <@&${pending_roleId}> START!`,
    `**Time to start Co-Working!**`,
    `-# \\> *Feeling motivated to work?*`,
    `-# \\> *Had something you need to finish up?* `,
    `-# \\> *Up to just hangout around the coworking crowd?*`,
    ``,
    `-# :bangbang: **If so, please consider joining your fellow coworkers to motivate you to get it done in this 4 hour session!**`,
  ]
  
  const prev_lines = [
    ``,
    `### :alarm_clock: <@&${prev_pending_roleId}> has concluded! Thank you for taking part!`,
    `-# \\> Feel free to share what you worked on in <#${process.env.WIPS_CHANNEL_ID}> and <#${process.env.SHOWCASE_CHANNEL_ID}>`,
    `-# \\> **Remember, breaks are important!** -but feel free to stick around and keep working if you've got it in you!`,
    `-# \\> -and **stay hydrated!** :cup_with_straw: `,
  ]

  await coworkingChannel.send([
    ...(currentValid ? lines : []),
    ...(prevValid ? prev_lines : [])
  ].join("\n"))
}