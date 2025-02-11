const print = console.log

import { Client, Events, GatewayIntentBits } from 'discord.js'

export const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences] })

client.on(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.username}!`)
});

// client.on(Events.InteractionCreate, async interaction => {
//   if (!interaction.isChatInputCommand()) return

//   if (interaction.commandName === 'ping') {
//     await interaction.reply('Pong!')
//   }
// })

client.login(process.env.TOKEN)