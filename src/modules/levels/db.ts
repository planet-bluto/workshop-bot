// import path from 'path'
// import { JSONFilePreset } from 'lowdb/node'

export type LevelCacheData = {
  member_id: string;
  exp: EXPEntries;
  clocked_in: boolean;
}[]

export type EXPEntries = {
  [index: string]: number;
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