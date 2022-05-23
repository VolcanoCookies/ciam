import mongoose, { Types } from 'mongoose';
import { REFS } from './refs.js';

const Schema = mongoose.Schema;

/**
 * A permission is just a label which other applications can use to determine if a user is allowed to do something
 */

export interface Permission {
	// A pretty name
	name: string;
	// A description of what this permission grants a user
	description: string;
	// The key for this permission, for example 'admin'
	key: string;
	// The path for this permission, for example 'ciam.roles', meant to be used as a scope
	path: string;
	// Full path of this permission, used to prevent identical permissions, consists of: 'path.key'
	flag: {
		type: string;
		index: true;
		unique: true;
	};
	// Who created this permission
	creator: Types.ObjectId;
}

const permissionSchema = new Schema<Permission>({
	name: String,
	description: String,
	key: String,
	path: String,
	flag: {
		type: String,
		index: true,
		unique: true,
	},
	creator: { type: Schema.Types.ObjectId, ref: REFS.USER },
});

export const permissionModel = mongoose.model<Permission>(
	REFS.PERMISSION,
	permissionSchema
);
