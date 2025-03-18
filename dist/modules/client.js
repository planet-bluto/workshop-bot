"use strict";
// const print = console.log
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const discord_js_1 = require("discord.js");
exports.client = new discord_js_1.Client({ intents: Object.values(discord_js_1.GatewayIntentBits).filter(entry => typeof (entry) == "number") }); // <= fuck you discord
exports.client.on(discord_js_1.Events.ClientReady, readyClient => {
    console.log(`Logged in as ${readyClient.user.username}!`);
});
// client.on(Events.InteractionCreate, async interaction => {
//   if (!interaction.isChatInputCommand()) return
//   if (interaction.commandName === 'ping') {
//     await interaction.reply('Pong!')
//   }
// })
exports.client.login(process.env.TOKEN);
