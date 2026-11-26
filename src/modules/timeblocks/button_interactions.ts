import { ButtonInteraction, Events, GuildMember, GuildMemberRoleManager, MessageFlags, Role } from "discord.js"

import { client } from "../client"
import { getOrCreateRole } from "../role_upkeep"

import { TIMEBLOCKS, WEEKDAYS } from "./base"

client.on(Events.InteractionCreate, async (raw_interaction) => {
  if (!raw_interaction.isButton()) { return }

  const interaction = raw_interaction as ButtonInteraction
  let deferred = false
  
  try {
    await interaction.deferReply({flags: MessageFlags.Ephemeral})
    deferred = true
  } catch(err) {
    return err
  }

  const reply = (content: string) => interaction.editReply({
    content,
  })
  
  if (!interaction.customId.startsWith("TIMEBLOCK_")) {
    await reply("Error, invalid customId")
    return
  }

  const customIdBits = interaction.customId.split("_")
  
  if (customIdBits.length != 3) {
    await reply("Error, invalid customIdBits length")
    return
  }
  
  const raw_day = customIdBits[1]
  const dayBits = raw_day.split(".")

  const raw_timeblock = customIdBits[2]

  const mode: "REMOVE" | "ADD" | "TOGGLE" = (dayBits[1] as "REMOVE" | "ADD" | undefined) ?? "TOGGLE"

  // const db = await TimeblockRoleMapDB()
  
  // const guild = await client.guilds.fetch(process.env.GUILD_ID)


  const days = dayBits[0] == "ALL" ? WEEKDAYS : [raw_day]
  const timeblocks = raw_timeblock == "ALL" ? TIMEBLOCKS : [raw_timeblock]

  let operationLog: {content: string; success: boolean}[] = []
  let add_operations: string[] = []
  let remove_operations: string[] = []

  const member_refetched = await (interaction.member as GuildMember).fetch(true)

  for (const timeblock of timeblocks) {
    for (const day of days) {
      const timeblockId = `${day}_${timeblock}`
      const roleName = `${day} - ${timeblock} BLOCK`

      let pending_role: Role = await getOrCreateRole("timeblock", timeblockId, roleName)

      if (pending_role == null) {
        // await reply("Error, couldn't find or create timeblock role")
        operationLog.push({success: false, content: `⚠ Error occured processing [ ${roleName} ] (Error Code 1: Couldn't find or create timeblock role)`})
        // errored = true
        continue
      }
      const hasRole = (member_refetched.roles as GuildMemberRoleManager).cache.has(pending_role.id)
      const operation = (mode == "TOGGLE" ? (hasRole ? 'remove' : 'add') : mode.toLowerCase());

      (operation == 'add' ? add_operations : remove_operations).push(pending_role.id)

      operationLog.push({success: true, content: `${operation == "remove" ? `- Removed [ ${roleName} ] role` : `+ Added [ ${roleName} ] role`}`})
    }
  }

  if (add_operations.length > 0) { await member_refetched.roles.add(add_operations) }
  if (remove_operations.length > 0) { await member_refetched.roles.remove(remove_operations) }

  let header = ""
  
  const results = operationLog.map(entry => entry.success)
  const all_success = results.every(success => success)
  const all_failed = results.every(success => (!success))

  if (all_success) {
    header = "✅ Success!"
  } else if (all_failed) {
    header = "❌ Failed..."
  } else {
    header = `:warning: Some errors (${results.filter(success => (!success)).length}) occured...\n-# Notify <@&${process.env.MOD_ROLE_ID}> about this error to get things settled!`
  }

  await reply([
    `# ${header}`,

    `\`\`\`diff`,
      `${operationLog.map(entry => entry.content).join("\n")}`,
    `\`\`\``
  ].join("\n"))
})