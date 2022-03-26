import mongoose, { Types, Schema } from 'mongoose';
import { REFS } from './refs.js';

/**
 * A role is an abstract grouping of permissions, it can be assigned to users or inherited by other roles.
 */

interface Role {
    // Id of the role, nothing special
    _id: Types.ObjectId,
    // Name of the role, 4-32 characters
    name: string,
    // The description of this role
    description: string,
    // Roles to inherit permissions from
    //inherit: Types.Array<Types.ObjectId>,
    // Explicit permissions for this role
    permissions: Types.Array<string>,
    // Who created this role
    creator: Types.ObjectId;
}

const RoleSchema = new Schema<Role>({
    _id: {
        type: Schema.Types.ObjectId,
        auto: true
    },
    name: {
        type: String,
        index: true
    },
    description: String,
    //inherit: [{ type: Schema.Types.ObjectId, refs: REFS.ROLE }],
    permissions: [{ type: String, ref: REFS.PERMISSION }],
    creator: { type: Schema.Types.ObjectId, ref: REFS.USER }
});

const Role = mongoose.model<Role>(REFS.ROLE, RoleSchema);

export { Role };