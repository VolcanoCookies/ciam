import { User } from './schemas/UserSchema.js';
import { Role } from './schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import { REFS } from './schemas/refs.js';
import _ from 'lodash';

/**
 * Rules for permissions:
 * 
 * 1. Required permissions cannot have wildcards
 * 2. Wildcards are only allowed on held permissions
 * 3. A permission cannot be empty
 * 4. A permission is a string of keys delimited by '.'
 * 5. A permission key has to either match '[a-z]+', or be a special key
 * 6. '*' can be used as a special key as the very end of a permission flag, will match anything
 * 7. '?' can be used as a special key anywhere in the flag, will match any single key
 * 
 */


// Our lord an savior Ash has come to bless us
class Flag extends String {
	isWildcard: boolean;
	keys: Array<string>;

	constructor(value: string) {
		if (!validFlag(value)) throw new Error(`Invalid permission flag ${value}`);
		super(value);

		this.isWildcard = value == '*' || value.endsWith('.*');
		this.keys = value.split('.');
	}

	public static validate(value: string | Flag): Flag {
		if (!(value instanceof Flag)) {
			return new Flag(value);
		}
		return value;
	}

	equals(other: Flag): boolean {
		return this.toString() == other.toString();
	}
}

/**
 * Check if a string is a valid permission flag.
 * 
 * @param perm a string to check.
 * @returns true if {@link perm} is a valid permission flag.
 */
function validFlag(perm: string): boolean {
	if (perm.length == 0) return false;
	return perm.match(/^(?:([a-z]+|\?)(?:\.(?:[a-z]+|\?))*(\.\*)?|\*)$/) != undefined;
}

/**
 * Check if a permission flag matches another, taking into consideration wildcards, and other special keys.
 * 
 * @param required A required permission flag.
 * @param held A held permission flag.
 * @returns true if {@link held} matches {@link required}.
 */
function has(required: Flag, held: Flag): boolean {
	if (required.length == 0 || held.length == 0) return false;
	if (held.keys > required.keys) return false;
	for (var i = 0; i < required.keys.length; i++) {
		if (held.keys[i] == '*') return true;
		else if (held.keys[i] == '?') continue;
		else if (held.keys[i] != required.keys[i]) return false;
	}
	return true;
}

/**
 * Check if a set of permission flags exist within another set of permission flags.
 * 
 * Calls {@link has} to check if individual flags match.
 * 
 * @param required permission flags to find within {@link held}.
 * @param held permission flags to look in.
 * @returns true if all flags in {@link required} have at least 1 flag in {@link held} that matches.
 */
function hasAll(required: Array<Flag>, held: Array<Flag>): boolean {
	if (required.some(r => r.isWildcard)) throw new Error('Required permissions cannot have wildcards.');
	return required.every(r => {
		return held.some(h => { return has(r, h); });
	});
}

async function flattenUser(user: Document<User> & User): Promise<Array<Flag>> {

	const flags = new Array<Flag>();

	user = await user.populate<{ roles: Types.Array<Role>; }>(REFS.ROLE, 'permissions');

	user.permissions.forEach(p => {
		try {
			flags.push(Flag.validate(p));
		} catch (e) { }
	});

	user.roles.forEach(r => {
		(<Role>r).permissions.forEach(p => {
			try {
				flags.push(Flag.validate(p));
			} catch (e) { }
		});
	});

	return _.uniq(flags);
}

function flattenRole(role: Role): Array<Flag> {

	const flags = new Array<Flag>();

	role.permissions.forEach(p => {
		try {
			flags.push(Flag.validate(p));
		} catch (e) { }
	});

	return _.uniq(flags);
}

async function hasPermissions(subject: (Document<User> & User) | (Document<Role> & Role), required: Array<Flag>): Promise<boolean> {
	const permissions = subject instanceof User ? await flattenUser(subject as Document<User> & User) : flattenRole(subject as Document<Role> & Role);
	return hasAll(_.uniq(required), permissions);
}

function flagArray(perms: Array<string>, ignoreInvalid: boolean = false, removeDuplicate: boolean = true): Array<Flag> {
	const valid = new Array<Flag>();
	for (const p of perms) {
		if (ignoreInvalid) {
			try {
				valid.push(Flag.validate(p));
			} catch (e) { }
		} else {
			valid.push(Flag.validate(p));
		}
	}
	return removeDuplicate ? _.uniq(valid) : valid;
}

export { Flag, has, hasAll, validFlag, flattenUser, flattenRole, hasPermissions, flagArray };