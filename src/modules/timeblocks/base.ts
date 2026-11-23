// import { ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, Events, GuildMember, GuildMemberRoleManager, MessageFlags, PermissionFlagsBits, PermissionsBitField, Role, SlashCommandBuilder, VoiceChannel } from "discord.js"
// import { CommandEntry } from "./interactions"
import { DateTime } from "luxon"
// import { client } from "./client"
// import schedule from "node-schedule"
// import path from "path"

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
export const TIMEBLOCKS = ["A", "B", "C", "D", "E", "F"]

export const TIMEBLOCK_HOUR_LENGTH = 24 / TIMEBLOCKS.length
export const TIMEBLOCK_DURATION = (86400000 / TIMEBLOCKS.length)

export const UTC_START_HOUR = 7

export const secTimestamp = (ms_timestamp: number) => Math.round(ms_timestamp / 1000)

export const getTimeblockInfo = (timeblock: string) => {
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