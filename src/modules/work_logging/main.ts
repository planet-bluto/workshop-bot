import { Events } from "discord.js";

import TaskManager from "../../lib/taskManager";

import { client } from "../client";

import { addEXP, COWORK_EXP_TYPE, updateClockedInStatus } from "../levels/api";
import rates from '../levels/rates';

import { WorklogDB } from "./db";
import { getLatestEntry } from "./calc";

const taskManager = new TaskManager(true, false)

async function handleClock(member_id: string, clock_in: boolean) {
  return taskManager.add(async () => {
    const db = await WorklogDB()

    if (db.data[member_id] == undefined) { db.data[member_id] = [] }

    if (clock_in == false) {
      const clockIn = await getLatestEntry(member_id, true)
      const timeSinceMS = (Date.now() - clockIn.timestamp)
      
      addEXP(member_id, COWORK_EXP_TYPE, timeSinceMS * rates.COWORK_PER_MS)
    }

    db.data[member_id].push({
      type: "time_punch",
      timestamp: Date.now(),
      clock_in
    })

    await Promise.all([
      updateClockedInStatus(member_id, clock_in),
      db.write()
    ])
  })
}

// async function clockIn(member_id: string) { handleClock(member_id, true) }
// async function clockOut(member_id: string) { handleClock(member_id, false) }

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const COWORKING_VOICE_CHANNELS = process.env.COWORKING_VOICE_CHANNELS.split(",")

  const joining = (newState != undefined && oldState?.channelId != newState?.channelId && COWORKING_VOICE_CHANNELS.includes(newState.channelId))
  const leaving = (oldState != undefined && oldState?.channelId != newState?.channelId && COWORKING_VOICE_CHANNELS.includes(oldState.channelId))

  if (leaving) { await handleClock(oldState.member.id, false) }
  if (joining) { await handleClock(newState.member.id, true) } 
})