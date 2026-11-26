import { ContextMenuCommandBuilder, Events, Interaction, REST, Routes, SlashCommandBuilder } from "discord.js";
import { client } from "./client";

import forwardToWipsInteraction from "./forward_to_wips"
import timeblockInteraction from "./timeblocks/setup_command"
import draftAnnouncementInteraction from "./announcement_drafter"
import { WorkLogCommand } from "./stat_commands";

export type ValidBuilders = ContextMenuCommandBuilder | SlashCommandBuilder
export type CommandEntry = [string, [ValidBuilders, (interaction: Interaction) => Promise<void>]]

const commands = new Map<string, [ValidBuilders, (interaction: Interaction) => Promise<void>]>([
  forwardToWipsInteraction,
  timeblockInteraction,
	draftAnnouncementInteraction,
	WorkLogCommand
]);

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
	try {
		console.log(`Refreshing application commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data: any = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: Array.from(commands.values()).map(entry => entry[0].toJSON()) });

		console.log(`Successfully reloaded ${data.length} application commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();


client.on(Events.InteractionCreate, (interaction: any) => {
	if (interaction?.commandName == undefined) return;
	print("interaction.commandName: ", interaction.commandName)

  const command = commands.get(interaction.commandName)

  if (command == undefined) { return }

  command[1](interaction)
})