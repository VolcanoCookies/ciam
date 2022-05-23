import { Client, Role } from 'discord.js';
import log from 'loglevel';
import { UNIT_TEST } from './config.js';
import { discordRoleModel } from './schemas/DiscordRoleSchema.js';

export const discordClient = new Client({ intents: [] });

discordClient.once('ready', () => {
	const user = discordClient.user;
	if (user === null) process.exit(4);
	log.info(`Logged in to discord as ${user.username}`);
});

discordClient.on('roleUpdate', (oldRole: Role, newRole: Role) => {
	if (oldRole.name !== newRole.name)
		void discordRoleModel.updateOne(
			{ _id: newRole.id },
			{ $set: { name: newRole.name } }
		);
});

discordClient.on('roleDelete', (role: Role) => {
	void discordRoleModel.updateOne(
		{ _id: role.id },
		{ $set: { deleted: true } }
	);
});

export const getUserRoleIds = (userId: string): string[] => {
	return discordClient.guilds.cache
		.map((g) => g.members.cache.get(userId))
		.filter((m) => m !== undefined)
		.flatMap((m) => m?.roles.cache.map((r) => r.id)) as string[];
};

if (!UNIT_TEST) void discordClient.login('123');
