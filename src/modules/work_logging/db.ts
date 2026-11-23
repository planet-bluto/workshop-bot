import path from 'path'
import { JSONFilePreset } from 'lowdb/node'

// interface WorkLogEntry {
//   type: "time_punch" | "promotion";
//   timestamp: number;
  
//   clock_in?: boolean;
// }

export type WorkLogEntry = TimePunchEntry | PromotionEntry

export interface TimePunchEntry {
  type: "time_punch";
  timestamp: number;
  clock_in: boolean;
}

export interface PromotionEntry {
  type: "promotion";
  timestamp: number;
}

export type WorkLogData = {
  [member_id: string]: WorkLogEntry[]
}

export const fetchDB = async () => {
  const defaultData: WorkLogData = {}
  return JSONFilePreset(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'db', 'worklog.json'), defaultData)
}