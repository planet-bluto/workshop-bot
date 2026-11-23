import path from 'path'
import { JSONFilePreset } from 'lowdb/node'

type TimeblockRoleMapData = {
  [timeblock_id: string]: string
}

export const fetchDB = async () => {
  const defaultData: TimeblockRoleMapData = {}
  return JSONFilePreset(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'db', 'timeblock_role_map.json'), defaultData)
}