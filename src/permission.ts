import { Permission } from './schemas/PermissionSchema.js';
import { User } from './schemas/UserSchema.js';
import { Role } from './schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import { REFS } from './schemas/refs.js';
import _, { min } from 'lodash';

// TODO: Figure out what exactly a permission is, and how to best represent it in code to optimize checking

class ValidatedPermissions {
	path: Array<string>;
	wildcard: boolean;
	length: number;
	raw: string;

	constructor(permissions: Array<string>) {
		this.wildcard = _.last(permissions) == '*';
		this.path = this.wildcard ? _.initial(permissions) : permissions;
		this.length = this.path.length;
		this.raw = _.join(permissions, '.');
	}

	has(other: ValidatedPermissions): boolean {
		function compareAll(arr1: Array<string>, arr2: Array<string>): boolean {
			for (var i = 0; i < Math.min(arr1.length, arr2.length); i++) {
				if (arr1[i] != arr2[i]) return false;
			}
			return true;
		}

		if (this.length == other.length) {
			if (this.wildcard != other.wildcard) return false;

			return compareAll(this.path, other.path);
		} else {
			return (this.length > other.length ? other.wildcard : this.wildcard) && compareAll(this.path, other.path);
		}
	}
}

class Wildcard {

	addKey(path: any) { }
	hasPermission(path: any): boolean {
		return true;
	}
}

class PermissionTree {
	branches: Map<string, PermissionTree | Wildcard> = new Map();

	addKey(path: Array<string>) {
		if (path.length == 0) return;

		if (path.length == 2 && path[1] == "*")
			this.branches.set(path[0], new Wildcard());
		else {
			var branch = this.branches.get(path[0]);
			if (branch) branch.addKey(path.slice(1));
			else {
				branch = new PermissionTree();
				branch.addKey(path.slice(1));
				this.branches.set(path[0], branch);
			}
		}

	}

	hasPermission(path: Array<string>): boolean {
		if (path.length == 0) return false;

		const branch = this.branches.get(path[0]);
		if (branch) return branch.hasPermission(path.slice(1));
		else return false;
	}

}

function validate(permission: string | Array<string>): ValidatedPermissions | undefined {
	if (Array.isArray(permission)) {
		const valid = permission.every((s, i) => {
			return i + 1 == permission.length ? s.match(/[a-z\*]+/) : s.match(/[a-z]+/);
		}) && permission.length > 0;
		if (valid) return new ValidatedPermissions(permission);
		else return undefined;
	} else {
		return validate(permission.split('.'));
	}
}

function filterValid(permissions: Array<string>): Array<string> {
	return permissions.map(p => validate(p))
		.filter(v => v != undefined)
		.map(v => v!!.raw);
}

async function flattenUser(user: Document<User> & User): Promise<Set<ValidatedPermissions>> {

	const permissions = new Set<ValidatedPermissions>();

	user = await user.populate<{ roles: Types.Array<Role>; }>(REFS.ROLE, 'permissions');

	user.permissions.forEach(p => {
		const v = validate(p);
		if (v) permissions.add(v);
	});

	user.roles.forEach(r => {
		(<Role>r).permissions.forEach(p => {
			const v = validate(p);
			if (v) permissions.add(v);
		});
	});

	return permissions;
}

function flattenRole(role: Role): Set<ValidatedPermissions> {

	const permissions = new Set<ValidatedPermissions>();

	role.permissions.forEach(p => {
		const v = validate(p);
		if (v) permissions.add(v);
	});

	return permissions;
}

// Returns true if required is empty
function has(current: Set<ValidatedPermissions>, required: Set<ValidatedPermissions>): boolean {
	const cur = Array.from(current);
	const req = Array.from(required);
	return req.every(r => {
		cur.some(c => c.has(r));
	});
}

async function hasPermissions(subject: (Document<User> & User) | (Document<Role> & Role), required: Set<ValidatedPermissions>): Promise<boolean> {
	const permissions = subject instanceof User ? await flattenUser(subject as Document<User> & User) : flattenRole(subject as Document<Role> & Role);
	return has(permissions, required);
}

export { validate, filterValid, ValidatedPermissions, has, hasPermissions, flattenUser, flattenRole };