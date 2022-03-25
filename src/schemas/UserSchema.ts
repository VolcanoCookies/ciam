import mongoose from 'mongoose';
import REFS from './refs';

const Schema = mongoose.Schema;
const Types = mongoose.Types;

/**
 * A user is most often a discord account, but could for example also be a service account for some application
 */

interface DiscordUser {
    // Discord id of this user
    id: string,
    // Discord username of this user
    username: string,
    // Discord discriminator of this user
    discriminator: number;
}

interface User {
    // Unique id for this user
    _id: Types.ObjectId,
    // Optional discord account information
    name: string,
    // Name of this user
    avatar: string,
    // Avatar of this user, TODO: figure out if url or ref or whatever
    roles: Types.Array<Types.ObjectId>,
    // The roles this user has, will inherit all their permissions
    permissions: Types.Array<Types.ObjectId>,
    // The explicit permissions this user has
    discord: DiscordUser;
}


const DiscordUserSchema = new Schema<DiscordUser>({
    id: {
        type: String,
        index: true
    },
    username: String,
    discriminator: Number,
});

const UserSchema = new Schema<User>({
    _id: Schema.Types.ObjectId,
    discord: {
        type: DiscordUserSchema,
        optional: true
    },
    name: String,
    avatar: String,
    roles: [{ type: Schema.Types.ObjectId, ref: REFS.ROLE }],
    permissions: [{ type: Schema.Types.ObjectId, ref: REFS.PERMISSION }]
});

const User = mongoose.model<User>(REFS.USER, UserSchema);

export default User;