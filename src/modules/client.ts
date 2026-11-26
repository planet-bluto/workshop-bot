// const print = console.log

import { APIMessage, Client, Events, GatewayIntentBits, Message, Routes } from 'discord.js'
import { getLeaderboard } from './levels/api';

export const client = new Client({ intents: Object.values(GatewayIntentBits).filter(entry => typeof(entry) == "number") }) // <= fuck you discord

client.on(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.username}!`)
  
  print("Leaderboard: ", (await getLeaderboard()))
});

// client.on(Events.InteractionCreate, async interaction => {
//   if (!interaction.isChatInputCommand()) return

//   if (interaction.commandName === 'ping') {
//     await interaction.reply('Pong!')
//   }
// })

client.login(process.env.TOKEN)