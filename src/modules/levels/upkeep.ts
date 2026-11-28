import { Events, VoiceBasedChannel } from "discord.js";

import { getWorkTimeSync } from "../work_logging/calc"
import { WorklogDB } from "../work_logging/db"
import { client } from "../client";

import * as levelsDB from "./db";
import { COWORK_EXP_TYPE, getEXP, levelingCheck, REACT_EXP_TYPE_PREFIX, setEXP, updateClockedInStatus } from "./api"
import rates from "./rates"
import { ShowcasePostDB } from "../reacts/db";


async function level_upkeep() {
// ...Scan worklog & reacts and add/set exp in cache
  const [worklog_db, post_db] = await Promise.all([WorklogDB(), ShowcasePostDB()])
  // const post_db = await ShowcasePostDB()
  
  const currently_coworking_members = (await Promise.all(
    process.env.COWORKING_VOICE_CHANNELS.split(",").map(chl_id => client.channels.fetch(chl_id))
  )).map(chl => (chl as VoiceBasedChannel).members.toJSON()).flat().map(member => member.id)

  levelsDB.cache.coworking_members = currently_coworking_members

  for (const member_id of Object.keys(worklog_db.data)) {
    const workTime = getWorkTimeSync(worklog_db, member_id, 0.0, Infinity)

    for (const session of workTime.sessions) {
      setEXP(
        member_id,
        `${COWORK_EXP_TYPE}_${session.range[0]}_${session.range[1]}`,
        session.exp,
        {
          duringInit: true,
          timeRange: session.range
        }
      )
    }

    updateClockedInStatus(member_id, currently_coworking_members.includes(member_id))
  }

  for (const entry of post_db.data) {
    setEXP(
      entry.author_id,
      `${REACT_EXP_TYPE_PREFIX}${entry.post_id}`,
      (entry.reacts * rates.PER_REACT) * (entry.for_post_day ? 2 : 1),
      {duringInit: true, timeRange: [entry.post_timestamp, entry.post_timestamp]}
    )
  }

  setInterval(coworkingLevelingCheck, 1000)

  print("levelsDB.cache.data: ", levelsDB.cache.data)
  levelsDB.cache.initialized = true
}

let coworkingLevelingCheckTimestamp = null
async function coworkingLevelingCheck() {
  for (const coworking_member_id of levelsDB.cache.coworking_members) {
    if (coworkingLevelingCheckTimestamp == null) { continue }
    
    const prevEXP = await getEXP(coworking_member_id, { atTimestamp: coworkingLevelingCheckTimestamp })
    const newEXP = await getEXP(coworking_member_id)

    // print("newEXP: ", newEXP)
    levelingCheck(coworking_member_id, prevEXP, newEXP)
  }

  coworkingLevelingCheckTimestamp = Date.now()
}

client.on(Events.ClientReady, level_upkeep)
