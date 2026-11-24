// import path from 'path'
// import { JSONFilePreset } from 'lowdb/node'

export type LevelCacheData = {
  member_id: string;
  exp: number;
  clocked_in: boolean;
}[]

export const PRESET_DATA = {
  exp: 0,
  clocked_in: false
}

// wait ts actually a cache
export var cache: {
  data: LevelCacheData;
  coworking_members: string[]
} = {
  data: [],
  coworking_members: []
}
// export const LevelCacheDB = async () => {
//   // const defaultData: LevelCacheData = []
//   return levelCache
// }