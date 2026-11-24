import { Low } from "lowdb/lib";
import { fetchDB, WorkLogData } from "./db";
import { DateTime, Duration } from "luxon";
import { modulo } from "../../lib/modulo";
// import { CELL_COUNT } from "./embed";

const HOUR = 3600000
const MIN = 60000
const SEC = 1000

const BASE_WAGE = 7.25
const PROMOTION_RATE = 2.25

export interface WorkTimeOutput {
  in_ms: number;
  in_hours: number;
  clock: string;
  fancy: string;
  usd: number;
  usd_formatted: string;
}

export async function getWorkTime(member_id: string, startTimestamp: number = 0.0, endTimestamp: number = Infinity): Promise<WorkTimeOutput> {
  const db = await fetchDB()

  let promotion_level = getPromotionLevelSync(db, member_id, startTimestamp)

  const entries = (db.data[member_id] ?? []).sort((entryA, entryB) => entryA.timestamp - entryB.timestamp).filter(entry => entry.timestamp >= startTimestamp && entry.timestamp <= endTimestamp)

  print("entries: ", entries)

  let totalTimeMS = 0.0
  let totalUSD = 0.0
  let currentWage = BASE_WAGE + (promotion_level * PROMOTION_RATE)

  const addTime = (ms: number) => {
    totalTimeMS += ms
    totalUSD += (ms / HOUR) * currentWage
  }

  let lastClockInTime = null
  for (const entry of entries) {
    switch (entry.type) {
      case 'time_punch':
        if (entry.clock_in) {
          lastClockInTime = entry.timestamp
        } else if (lastClockInTime != null) {
          addTime(entry.timestamp - lastClockInTime)
          lastClockInTime = null
        }
      break;
      case 'promotion':
        currentWage += PROMOTION_RATE
      break;
    }
  }

  // Count (supposed) current time in VC
  if (lastClockInTime != null) {
    addTime(Date.now() - lastClockInTime)
  }

  const hours = Math.floor(totalTimeMS / HOUR)
  const mins = Math.floor((totalTimeMS - (hours * HOUR)) / MIN)
  const secs = Math.floor((totalTimeMS - (hours * HOUR) - (mins * MIN)) / SEC)
  const ms = Math.floor((totalTimeMS - (hours * HOUR) - (mins * MIN) - (secs * SEC)))

  return {
    in_ms: totalTimeMS,
    in_hours: (totalTimeMS / HOUR),
    clock: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`,
    fancy: `${String(hours)}h ${String(mins)}m ${String(secs)}s ${String(ms).padStart(3, '0')}ms`,
    usd: totalUSD,
    usd_formatted: `$${totalUSD.toFixed(2)}`
  }
}

export const calcSuperOrdinal = (timestamp: number) => Math.round(DateTime.fromMillis(timestamp).startOf('day').diff(DateTime.fromMillis(0).startOf('day'), "days").days);
export const timestampFromSuperOrdinal = (superOrdinal: string | number) => DateTime.fromMillis(0).startOf('day').plus(Duration.fromObject({days: Number(superOrdinal)})).toMillis();
export const calcStartOfDay = (timestamp: number) => DateTime.fromMillis(timestamp).startOf('day').toMillis();
export const calcEndOfDay = (timestamp: number) => DateTime.fromMillis(timestamp).endOf('day').toMillis();
export const calcMyWeekDay = (timestamp: number) => modulo((modulo(DateTime.fromMillis(timestamp).weekday, 7) - 1), 7);

export async function getHeatMapData(member_id: string): Promise<{startDay: number; data: number[]}> {
  const dayMap = await getDayMap(member_id)
  const dayMapKeys = Object.keys(dayMap)

  if (dayMapKeys.length == 0) { return {startDay: 0, data: []} }

  // const startDay = calcMyWeekDay()
  const highestDayHours = Array.from(Object.values(dayMap)).reduce((prev, curr) => Math.max(prev, curr), 0.0);

  print("highestDayHours: ", highestDayHours)

  return { startDay: timestampFromSuperOrdinal(dayMapKeys[dayMapKeys.length-1]), data: Object.values(dayMap).map(hours => (hours / highestDayHours)) }
}

export async function getDayMap(member_id: string): Promise<{[superOrdinal: string]: number}> {
  const db = await fetchDB()

  // const startTimestamp = DateTime.now().minus(Duration.fromObject({days: CELL_COUNT})).startOf('day').toMillis()
  const startTimestamp = 0.0
  const endTimestamp = Date.now()

  const entries = (db.data[member_id] ?? [])
    .sort((entryA, entryB) => entryA.timestamp - entryB.timestamp)
    .filter(entry => entry.timestamp >= startTimestamp && entry.timestamp <= endTimestamp)
    .filter(entry => entry.type == "time_punch")
  
  if (entries.length == 0) { return {} }

  if (entries[0].clock_in == false) {
    
    const dayStartTimestamp = DateTime.fromMillis(entries[0].timestamp)
    .startOf('day')
    .toMillis()

    entries.unshift({
      type: "time_punch",
      clock_in: true,
      timestamp: dayStartTimestamp,
    })
  }

  // let highestDayHours = 0.0

  // ((7 % 7) - 1) % 7
  // let startDay = modulo((modulo(DateTime.fromMillis(entries[entries.length-1].timestamp).weekday, 7) - 1), 7)
  let dayMap: {[superOrdinal: string]: number} = {}
  // let data: number[] = []

  let lastClockInTime = null
  let lastOrdinal = null

  const trackDay = (start, end) => {
    const startOrd = calcSuperOrdinal(start)
    const endOrd = calcSuperOrdinal(end)
    
    if (startOrd == endOrd) {
      dayMap[String(startOrd)] += (end - start)
    } else {
      dayMap[String(startOrd)] += (calcEndOfDay(start) - start)
      dayMap[String(endOrd)] += (end - calcStartOfDay(end))
    }

    // for (const ord of [startOrd, endOrd]) {
    //   if (dayMap[String(ord)] > highestDayHours) {
    //     highestDayHours = dayMap[String(ord)]
    //   }
    // }
  }

  for (const entry of entries) {
    const superOrdinal = calcSuperOrdinal(entry.timestamp)
    lastOrdinal = superOrdinal
    
    if (dayMap[String(superOrdinal)] == undefined) { dayMap[String(superOrdinal)] = 0 }

    if (entry.clock_in) {
      lastClockInTime = entry.timestamp
    } else if (lastClockInTime != null) {
      // const clockInOrdinal = lastClockInTime
      trackDay(lastClockInTime, entry.timestamp)
      lastClockInTime = null
    }
  }

  if (lastClockInTime != null && lastOrdinal != null) {
    print("still in vc...")

    const superOrdinal = calcSuperOrdinal(Date.now())

    if (lastOrdinal == superOrdinal) {
      trackDay(lastClockInTime, Date.now())
    } else {
      const endOfDay = calcEndOfDay(lastClockInTime)
      trackDay(lastClockInTime, endOfDay)
    }
  }

  const dayMapKeys = Object.keys(dayMap)
  for (let i = Number(dayMapKeys[0]); i < Number(dayMapKeys[dayMapKeys.length-1]); i++) {
    if (dayMap[String(i)] == undefined) { dayMap[String(i)] = 0.0 }
  }

  print("dayMap: ", dayMap)

  // return { startDay, data: Object.values(dayMap).map(hours => (hours / highestDayHours)) }
  return dayMap
}

export async function getPromotionLevel(member_id: string, as_of: number = 0): Promise<number> {
  const db = await fetchDB()
  
  return getPromotionLevelSync(db, member_id, as_of)
  
}

export function getPromotionLevelSync(db: Low<WorkLogData>, member_id: string, as_of: number = 0): number {
  if (db.data[member_id] == undefined) { return 0 }
  return db.data[member_id].filter(entry => entry.timestamp <= as_of && entry.type == "promotion").length
}