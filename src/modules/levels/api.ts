import { Low } from "lowdb/lib";

import TaskManager from "../../lib/taskManager";

import { getLatestEntrySync } from "../work_logging/calc";
import { WorkLogData, WorklogDB } from "../work_logging/db";

import * as levelsDB from "./db";
import rates from "./rates";
import EventEmitter from "eventemitter3";

const taskManager = new TaskManager()

export const LevelEvents = new EventEmitter


export function getLevelCacheFromMemberID(member_id: string) {
  // const this_db = levelsDB.cache

  let idx = levelsDB.cache.data.findIndex(entry => entry.member_id == member_id)
  
  if (idx == -1) {
    idx = levelsDB.cache.data.length
    levelsDB.cache.data.push(Object.assign(
      { member_id },
      {
        exp: {},
        clocked_in: levelsDB.cache.coworking_members.includes(member_id)
      }
    ))
  }

  return {idx, cache: levelsDB.cache[idx]}
}

export const COWORK_EXP_TYPE = "COWORKING"
export const REACT_EXP_TYPE_PREFIX = "POST_"

export function addEXP(member_id: string, type: string, exp: number, duringInit: boolean = false) {
  taskManager.add(async () => {
    const { idx } = getLevelCacheFromMemberID(member_id)
    
    let prevEXP = await getEXP(member_id)
    if (!duringInit) { prevEXP = await getEXP(member_id) }

    if (levelsDB.cache.data[idx].exp[type] == undefined) { levelsDB.cache.data[idx].exp[type] = 0 }

    levelsDB.cache.data[idx].exp[type] += exp

    let newEXP = 0.0
    if (!duringInit) { newEXP = await getEXP(member_id) }

    if (!duringInit) { levelingCheck(member_id, prevEXP, newEXP) }
  })
}

export function setEXP(member_id: string, type: string, exp: number, duringInit: boolean = false) {
  taskManager.add(async () => {
    const { idx } = getLevelCacheFromMemberID(member_id)

    let prevEXP = await getEXP(member_id)
    if (!duringInit) { prevEXP = await getEXP(member_id) }

    if (exp == 0) {
      delete levelsDB.cache.data[idx].exp[type]
    } else {
      levelsDB.cache.data[idx].exp[type] = exp
    }

    let newEXP = 0.0
    if (!duringInit) { newEXP = await getEXP(member_id) }

    if (!duringInit) { levelingCheck(member_id, prevEXP, newEXP) }
  })
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

export function getEXPSync(worklog_db: Low<WorkLogData>, member_id: string, atTimestamp: number = Date.now()) {
  const { idx } = getLevelCacheFromMemberID(member_id)

  let totalEXP = Object.values(levelsDB.cache.data[idx].exp).reduce((prev, curr) => prev + curr, 0)

  if (levelsDB.cache.data[idx].clocked_in) {
    const latestClockIn = getLatestEntrySync(worklog_db, member_id, true)
    if (latestClockIn == undefined) { return totalEXP }
    const timeSinceMS = (atTimestamp - latestClockIn.timestamp)

    totalEXP += (timeSinceMS * rates.COWORK_PER_MS)
  }

  return totalEXP
}

export async function getEXP(member_id: string, atTimestamp: number = Date.now()) {
  const db = await WorklogDB()
  
  return getEXPSync(db, member_id, atTimestamp)
}

export function calcLevel(exp: number) {
  return Math.floor(Math.sqrt(exp / rates.LEVEL_SCALE_FACTOR))
}

export function calcEXPinLevel(lvl: number) {
  return Math.ceil(Math.pow(lvl, 2) * rates.LEVEL_SCALE_FACTOR)
}

export function calcLevelProgress(exp: number) {
  const nextLevel = (Math.floor(Math.sqrt(exp / rates.LEVEL_SCALE_FACTOR))) + 1
  return (exp / calcEXPinLevel(nextLevel))
}

export async function getLeaderboard() {
  const db = await WorklogDB()

  return levelsDB.cache.data.map(entry => ({
    member_id: entry.member_id,
    exp: getEXPSync(db, entry.member_id),
    clocked_in: entry.clocked_in
  })).sort((entryA, entryB) => entryB.exp - entryA.exp)
}

let firedLevelEvents: string[] = []

export function levelingCheck(member_id: string, prevEXP: number, newEXP: number) {
  const prevLVL = calcLevel(prevEXP)
  const newLVL = calcLevel(newEXP)

  if (!levelsDB.cache.initialized) { return }

  const LevelUpID = `up_${member_id}_${newLVL}`
  // const LevelDownID = `down_${member_id}_${newLVL}`

  if (newLVL > prevLVL && !firedLevelEvents.includes(LevelUpID)) {
    LevelEvents.emit("level_up", member_id, newLVL)
    firedLevelEvents.push(LevelUpID)
  }
  // if (newLVL < prevLVL && !firedLevelEvents.includes(LevelDownID)) { LevelEvents.emit("level_down", member_id, newLVL, prevEXP) }
}