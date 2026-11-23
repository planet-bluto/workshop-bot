import { Events } from "discord.js";
import { client } from "../client";
import { fetchDB } from "./db";
import TaskManager from "../../lib/taskManager";

const taskManager = new TaskManager(true, true)

async function main() {
  const db = await fetchDB()

  async function clockIn(member_id: string) {
    return taskManager.add(async () => {
      if (db.data[member_id] == undefined) { db.data[member_id] = [] }

      db.data[member_id].push({
        type: "time_punch",
        timestamp: Date.now(),
        clock_in: true
      })

      await db.write()
    })
  }

  async function clockOut(member_id: string) {
    return taskManager.add(async () => {
      if (db.data[member_id] == undefined) { return }

      db.data[member_id].push({
        type: "time_punch",
        timestamp: Date.now(),
        clock_in: false
      })

      await db.write()
    })
  }

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const COWORKING_VOICE_CHANNELS = process.env.COWORKING_VOICE_CHANNELS.split(",")

    const joining = (newState != undefined && oldState?.channelId != newState?.channelId && COWORKING_VOICE_CHANNELS.includes(newState.channelId))
    const leaving = (oldState != undefined && oldState?.channelId != newState?.channelId && COWORKING_VOICE_CHANNELS.includes(oldState.channelId))

    if (leaving) { clockOut(oldState.member.id) }
    if (joining) { clockIn(newState.member.id) } 
  })
}

main()