import { Flag } from 'ciam-commons';
import mongoose, { Document, Types } from 'mongoose';
import { flagGetter, flagSetter } from '../utils.js';
import { REFS } from './refs.js';

const Schema = mongoose.Schema;

/**
 * A user is most often a discord account, but could for example also be a service account for some application
 */

enum UserType {
	USER = 'user',
	BOT = 'bot',
	SYSTEM = 'system',
}

interface DiscordUser {
	// Discord id of this user
	id: string;
	// Discord username of this user
	username?: string;
	// Discord discriminator of this user
	discriminator?: number;
}

interface User {
	// Unique id for this user
	_id: Types.ObjectId;
	// Optional discord account information
	name: string;
	// Name of this user
	avatar: string;
	// Avatar of this user, TODO: figure out if url or ref or whatever
	roles: string[];
	// The roles this user has, will inherit all their permissions
	permissions: Flag[];
	// The explicit permissions this user has
	discord: DiscordUser;
	// The type of the account
	type: UserType;
}

type UserEntry = Document<unknown, any, User> & User & { _id: Types.ObjectId };

const discordUserSchema = new Schema<DiscordUser>({
	id: {
		type: String,
		index: true,
	},
	username: String,
	discriminator: String,
});

const userSchema = new Schema<User>({
	discord: {
		type: discordUserSchema,
		optional: true,
	},
	name: {
		type: String,
		index: true,
	},
	avatar: String,
	roles: [
		{
			type: Schema.Types.ObjectId,
			ref: REFS.ROLE,
		},
	],
	permissions: [
		{
			type: String,
			set: flagSetter,
			get: flagGetter,
		},
	],
	type: {
		type: String,
		enum: UserType,
	},
});

const userModel = mongoose.model<User>(REFS.USER, userSchema);

export { userModel, User, UserEntry, UserType, DiscordUser };
