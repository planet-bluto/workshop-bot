import schedule from "node-schedule"
import { Events, VoiceChannel } from "discord.js";
import { DateTime, Duration } from "luxon";

import { client } from "../client"
import { TIMEBLOCKS, TIMEBLOCK_HOUR_LENGTH, UTC_START_HOUR, WEEKDAYS } from "./base";
import { TimeblockRoleMapDB } from "./db";
import { modulo } from "../../lib/modulo";

const rule = new schedule.RecurrenceRule();
rule.minute = 0;
rule.tz = 'Etc/UTC';

const job = schedule.scheduleJob(rule, hourlyPingCheck);

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.id == "334039742205132800" && msg.content.startsWith("!pingchecktest")) { hourlyPingCheck() }
})

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

  const db = await TimeblockRoleMapDB()

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
  const prevValid = ((prev_pending_role?.members?.size ?? 0) > 0 && (coworkingChannel?.members?.size ?? 0) > 0)

  if (!prevValid && !currentValid) { print(`Would fire ping for ${timeblockId}, but roles are empty or non-existent`); return }

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