// import path from 'path'
// import { JSONFilePreset } from 'lowdb/node'

import { TimeRange } from "../timerange";

export type LevelCacheData = {
  member_id: string;
  exp: EXPEntries;
  clocked_in: boolean;
}[]

export type EXPEntries = {
  [index: string]: {
    exp: number,
    timeRange: TimeRange // Timestamp to Timestamp
  };
}

export const PRESET_DATA = {
  exp: {},
  clocked_in: false
}

// wait ts actually a cache
export var cache: {
  initialized: boolean;
  data: LevelCacheData;
  coworking_members: string[]
} = {
  initialized: false,
  data: [],
  coworking_members: []
}

// export const LevelCacheDB = async () => {
//   // const defaultData: LevelCacheData = []
//   return levelCache
// }