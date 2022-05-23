import { Flag } from 'ciam-commons';
import mongoose, { Document } from 'mongoose';
import { flagGetter, flagSetter } from '../utils.js';
import { REFS } from './refs.js';

const Schema = mongoose.Schema;

interface DiscordRole {
	_id: string;
	name: string;
	guildId: string;
	deleted: boolean;
	permissions: Flag[];
}

const discordRoleSchema = new Schema<DiscordRole>({
	_id: {
		type: String,
		required: true,
	},
	name: {
		type: String,
		required: true,
	},
	guildId: {
		type: String,
		requried: true,
	},
	deleted: {
		type: Boolean,
		default: false,
		required: true,
	},
	permissions: [
		{
			type: String,
			set: flagSetter,
			get: flagGetter,
		},
	],
});

export type DiscordRoleEntry = Document<unknown, any, DiscordRole> &
	DiscordRole & { _id: string };

export const discordRoleModel = mongoose.model<DiscordRole>(
	REFS.DISCORD_ROLE,
	discordRoleSchema
);
