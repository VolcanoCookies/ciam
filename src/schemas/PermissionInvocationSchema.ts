import { Flag } from 'ciam-commons';
import mongoose from 'mongoose';
import { flagGetter, flagSetter } from '../utils.js';
import { REFS } from './refs.js';

const Schema = mongoose.Schema;

export interface PermissionInvocation {
	userId: string;
	flag: Flag;
	expires: Date;
}

const permissionInvocationSchema = new Schema<PermissionInvocation>({
	userId: {
		type: String,
		required: true,
		index: true,
	},
	flag: {
		type: String,
		required: true,
		set: flagSetter,
		get: flagGetter,
	},
	expires: {
		type: Date,
		expires: 0,
		required: true,
	},
});

export const permissionInvocationModel = mongoose.model<PermissionInvocation>(
	REFS.PERMISSION_INVOCATION,
	permissionInvocationSchema
);
