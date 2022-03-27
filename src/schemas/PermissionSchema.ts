import mongoose, { Types, Schema } from 'mongoose';
import { REFS } from './refs.js';

/**
 * A permission is just a label which other applications can use to determine if a user is allowed to do something
 */

interface Permission {
    // A pretty name
    name: string,
    // A description of what this permission grants a user
    description: string,
    // The key for this permission, for example 'admin'
    key: string,
    // The path for this permission, for example 'ciam.roles', meant to be used as a scope
    path: string,
    // Full path of this permission, used to prevent identical permissions, consists of: 'path.key'
    fullPath: {
        type: String,
        index: true,
        unique: true;
    },
    // Who created this permission
    creator: Types.ObjectId;
}

const PermissionSchema = new Schema<Permission>({
    name: String,
    description: String,
    key: String,
    path: String,
    fullPath: {
        type: String,
        index: true,
        unique: true
    },
    creator: { type: Schema.Types.ObjectId, ref: REFS.USER }
});

const Permission = mongoose.model<Permission>(REFS.PERMISSION, PermissionSchema);

export { Permission };