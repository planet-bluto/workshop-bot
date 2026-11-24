import * as levelsDB from "./db";
import { getWorkTimeSync } from "../work_logging/calc"
import { WorklogDB } from "../work_logging/db"
import rates from "./rates"
import { addEXP, updateClockedInStatus } from "./api"
import { client } from "../client";
import { VoiceBasedChannel } from "discord.js";

async function level_upkeep() {
// ...Scan worklog & reacts and add/set exp in cache
  const worklog_db = await WorklogDB()
  
  const currently_coworking_members = (await Promise.all(
    process.env.COWORKING_VOICE_CHANNELS.split(",").map(chl_id => client.channels.fetch(chl_id))
  )).map(chl => (chl as VoiceBasedChannel).members.toJSON()).flat().map(member => member.id)

  levelsDB.cache.coworking_members = currently_coworking_members

  for (const member_id of Object.keys(worklog_db.data)) {
    const workTime = getWorkTimeSync(worklog_db, member_id, 0.0, Infinity)
    addEXP(member_id, workTime.in_hours * rates.COWORK_PER_HOUR)
    updateClockedInStatus(member_id, currently_coworking_members.includes(member_id))
  }

  print("levelsDB.cache.data: ", levelsDB.cache.data)
}

client.on("ready", level_upkeep)
