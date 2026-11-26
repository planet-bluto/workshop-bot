import "./extends/print"

import "dotenv/config"

import { Events } from "discord.js";
import { client } from "./modules/client";

client.on(Events.ClientReady, async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID)

  const roles = await guild.roles.fetch()
  
  print("roles: ", roles.map(role => ({
    name: role.name,
    rawPosition: role.rawPosition,
  })))
})