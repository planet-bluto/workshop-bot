import { Role, TextChannel } from "discord.js";

import { client } from "../client";
import { getOrCreateRole, RoleMapDB } from "../role_upkeep";

import { LevelEvents } from "./api";
import { WorkCardEmbed } from "../stat_commands";

LevelEvents.on("level_up", async (member_id: string, newLVL: number) => {
  const db = await RoleMapDB("levels")
  const lvlId = String(newLVL)
  let roleName = `Lvl. ${newLVL} Worker` // Lvl. 1 Worker ...yea that's fine
  
  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  const member = await guild.members.fetch(member_id)

  let pending_role: Role = await getOrCreateRole("levels", lvlId, roleName)

  await Promise.all([
    member.roles.remove(Object.keys(db.data).filter(roleId => roleId != pending_role.id)),
    member.roles.add(pending_role),
  ])

  const statusChannel = (await guild.channels.fetch(process.env.STATUS_CHANNEL_ID)) as TextChannel

  const embedMsgOptions = await WorkCardEmbed(member)

  await statusChannel.send(Object.assign(embedMsgOptions, {
    content: `# *@${member.id} has leveled up to...* \`\`Lvl. ${newLVL}\`\`!`
  }))
})