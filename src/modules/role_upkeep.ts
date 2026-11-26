import { Events, Guild, Role } from "discord.js"

import { client } from "./client"
import { Low } from "lowdb/lib"
import { TIMEBLOCKS, WEEKDAYS } from "./timeblocks/base"
import { JSONFilePreset } from "lowdb/node"
import path from 'path';

// First time I was semi-competent with regex and I didn't need it- NVM
const TimeblockRoleNameRegex = /[A-Z]{3}\ \-\ [A-F]\ BLOCK/m
const LevelRoleNameRegex = /Lvl\.\ ([1-9]|[1-9][0-9]|100){1,}\ Worker/m


// HERE WE ARE FETCHING ROLES, AUTO ASSIGNING ROLES BY NAME, AND SORTING AND COLORING ROLES AND SUCH

export type RoleMapType = "timeblock" | "levels"

export type RoleMapData = {
  [key: string]: string
}

export const RoleMapDB: (type: RoleMapType) => Promise<Low<RoleMapData>> = (type: RoleMapType) => {
  let defaultData: RoleMapData = {}
  return JSONFilePreset(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'db', `${type}_role_map.json`), defaultData)
}

type NameMaker = (key: string) => string

type RoleDictEntry = {
  fetchDB(): Promise<Low<RoleMapData>>,
  upkeep(): Promise<any>,
  nameMaker: NameMaker,
  sortFunc(a: string, b: string): number,
  headerRoleId: string,
  regex: RegExp
}

export const RoleDict: {[index: string]: RoleDictEntry} = {
  timeblock: {
    fetchDB: () => RoleMapDB("timeblock"),
    upkeep: timeblockRoleUpkeep,
    nameMaker: (key: string) => `${key.split("_")[0]} - ${key.split("_")[1]} BLOCK`,
    sortFunc: (a, b) => {
      const dayA = a.split("_")[0]
      const blockA = a.split("_")[1]
      const dayB = b.split("_")[0]
      const blockB = b.split("_")[1]
      if (dayA != dayB) {
        return WEEKDAYS.indexOf(dayA) - WEEKDAYS.indexOf(dayB)
      } else {
        return TIMEBLOCKS.indexOf(blockA) - TIMEBLOCKS.indexOf(blockB)
      }
    },
    headerRoleId: process.env.TIMEBLOCK_HEADER_ROLE,
    regex: TimeblockRoleNameRegex
  },
  levels: {
    fetchDB: () => RoleMapDB("levels"),
    upkeep: levelRoleUpkeep,
    nameMaker: (key: string) => `Lvl. ${key} Worker`,
    sortFunc: (a, b) => Number(a.split(" ")[1]) - Number(b.split(" ")[1]),
    headerRoleId: process.env.LEVELS_HEADER_ROLE,
    regex: LevelRoleNameRegex
  },
}

export const safeFetchRole = async (roleId: string): Promise<Role | null> => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID)
    return (await guild.roles.fetch(roleId))
  } catch (_err) {
    return null
  }
}

export const getOrCreateRole = async (type: "timeblock" | "levels", key, roleName): Promise<Role> => {
  const {fetchDB} = RoleDict[type]

  const db = await fetchDB()

  let pending_role: Role | null = await (db.data[key] ? safeFetchRole(db.data[key]) : createRole(type, key, roleName))

  if (pending_role == null) { pending_role = await createRole(type, key, roleName) }

  if (pending_role != null && db.data[key] != pending_role?.id) {
    db.data[key] = pending_role.id

    await db.write()
  }

  return pending_role
}

export const createRole = async (type: RoleMapType, key, roleName, doUpkeep: boolean = true) => {
  print(type, key, roleName)

  const {fetchDB} = RoleDict[type]

  const db = await fetchDB()
  const guild = await client.guilds.fetch(process.env.GUILD_ID)

  const newRole = await guild.roles.create({
    name: roleName
  })

  // if (newRole == null || newRole == undefined) { return }

  db.data[key] = newRole.id

  if (newRole != null && db.data[key] != newRole?.id) {
    db.data[key] = newRole.id
    
    await db.write()
  }

  // Sorting Func....
  // const entries = Object.keys(db.data)
  // .sort(sortFunc)
  // .map(key => ([key, db.data[key]]))

  // db.data = Object.fromEntries(entries)

  // await db.write()

  // await sortRoles(type)

  // if (doUpkeep) {await upkeep()}

  // const timeblockHeaderRole = await guild.roles.fetch(headerRoleId)

  // const positionPayload = Object.values(db.data).map((role, idx) => ({
  //   role,
  //   position: timeblockHeaderRole.rawPosition - (idx + 1)
  // }))

  // await guild.roles.setPositions(positionPayload)

  return newRole
}

const sortRoles = async (type: RoleMapType) => {
  const {fetchDB, sortFunc, headerRoleId} = RoleDict[type]

  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  const db = await fetchDB()

  const entries = Object.keys(db.data)
  .sort(sortFunc)
  .map(key => ([key, db.data[key]]))
  
  await db.write()

  db.data = Object.fromEntries(entries)

  // let headerRole = await guild.roles.fetch(headerRoleId)

  let idx = 0
  for (const roleId of Object.values(db.data)) {
    const headerRole = await guild.roles.fetch(headerRoleId)
    await guild.roles.setPosition(roleId, headerRole.rawPosition - (idx + 1))
    idx += 1
  }

  // const positionPayload = Object.values(db.data).map((role, idx) => ({
  //   role,
  //   position: headerRole.rawPosition - (idx + 1)
  // }))

  // await guild.roles.setPositions(positionPayload)
}

const generalUpkeep = async (type: "timeblock" | "levels") => {
  const {fetchDB, nameMaker, regex} = RoleDict[type]
  const db = await fetchDB()

  
  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  const roles = await guild.roles.fetch()

  print("roles => ", roles.map(role => ({
    id: role.id,
    name: role.name,
    position: role.position,
    rawPosition: role.rawPosition
  })))


  const databasedIds = Object.keys(db.data)
  print("databasedIds: ", databasedIds)
  

  
  let rolesToPurge = roles.toJSON().filter(role => regex.test(role.name)).map(role => role.name)

  for (const id of databasedIds) {
    const roleName = nameMaker(id)
    rolesToPurge = rolesToPurge.filter(thisRoleName => thisRoleName != roleName)

    let foundRoles = roles.filter(role => role.name == roleName)

    const databasedRoleId = db.data[id]
    
    // Remove undatabased...
    const undatabasedRoles = foundRoles.filter(role => role.id != databasedRoleId)

    for (const [undatabasedRoleId, undatabasedRole] of undatabasedRoles) {
      await undatabasedRole.delete()
      foundRoles = foundRoles.filter(role => role.id != undatabasedRoleId)
    }

    // Create missing role if none exist...
    if (foundRoles.size == 0) {
      await createRole(type, id, roleName, false)
    }
  }

  print("rolesToPurge: ", rolesToPurge)

  if (rolesToPurge.length > 0) {
    const foundRoles = (await guild.roles.fetch()).toJSON().filter(role => rolesToPurge.includes(role.name))

    for (const foundRole of foundRoles) {
      await foundRole.delete()
    }
  }

  await sortRoles(type)

  return { db, guild }
}

export async function timeblockRoleUpkeep() {
  const { db, guild } = await generalUpkeep("timeblock")
  // COLORING...
}

export async function levelRoleUpkeep() {
  const { db, guild } = await generalUpkeep("levels")
  // COLORING...
}

client.on(Events.ClientReady, async () => {
  await timeblockRoleUpkeep()
  await levelRoleUpkeep()
})