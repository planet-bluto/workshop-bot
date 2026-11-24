// import { Low } from "lowdb/lib";

// import TaskManager from "../../lib/taskManager";

import { Low } from "lowdb/lib";
import { getLatestEntry, getLatestEntrySync } from "../work_logging/calc";
import * as levelsDB from "./db";
import { PRESET_DATA } from "./db";
import rates from "./rates";
import { WorkLogData, WorklogDB } from "../work_logging/db";

// const taskManager = new TaskManager(true, false)

export function getLevelCacheFromMemberID(member_id: string) {
  // const this_db = levelsDB.cache

  let idx = levelsDB.cache.data.findIndex(entry => entry.member_id == member_id)
  
  if (idx == -1) {
    idx = levelsDB.cache.data.length
    levelsDB.cache.data.push(Object.assign(
      { member_id },
      {
        exp: 0,
        clocked_in: levelsDB.cache.coworking_members.includes(member_id)
      }
    ))
  }

  return {idx, cache: levelsDB.cache[idx]}
}

export function addEXP(member_id: string, exp: number) {
  const { idx } = getLevelCacheFromMemberID(member_id)

  levelsDB.cache.data[idx].exp += exp
}

export function updateClockedInStatus(member_id: string, clocked_in: boolean) {
  const { idx } = getLevelCacheFromMemberID(member_id)

  levelsDB.cache.data[idx].clocked_in = clocked_in

  if (clocked_in) {
    levelsDB.cache.coworking_members.push(member_id)
  } else {
    levelsDB.cache.coworking_members = levelsDB.cache.coworking_members.filter(mem_id => mem_id != member_id)
  }
}

export function getEXPSync(db: Low<WorkLogData>, member_id: string) {
  const { idx } = getLevelCacheFromMemberID(member_id)

  if (!levelsDB.cache.data[idx].clocked_in) {
    return levelsDB.cache.data[idx].exp
  } else {
    const latestClockIn = getLatestEntrySync(db, member_id, true)
    const hoursSince = (Date.now() - latestClockIn.timestamp) / 3600000

    return levelsDB.cache.data[idx].exp + (hoursSince * rates.COWORK_PER_HOUR)
  }
}

export async function getEXP(member_id: string) {
  const db = await WorklogDB()
  
  return getEXPSync(db, member_id)
}

export async function getLeaderboard() {
  const db = await WorklogDB()  

  return levelsDB.cache.data.map(entry => ({
    member_id: entry.member_id,
    exp: getEXPSync(db, entry.member_id),
    clocked_in: entry.clocked_in
  })).sort((entryA, entryB) => entryB.exp - entryA.exp)
}