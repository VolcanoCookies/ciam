import { User, UserEntry } from './schemas/UserSchema.js';
import { Role, RoleEntry } from './schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import _ from 'lodash';
import { Request, Response, NextFunction } from 'express';
import { Check, Model } from 'ciam-commons';
import { getUserRoles } from './utility.js';

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

class PermissionError extends Error {
	constructor(missing: Array<string> | Array<Model.Flag> | undefined) {
		super(`Missing permissions: ${(missing || []).join(', ')}`);
		this.name = 'PermissionError';
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
	try {
		Check.flag(perm);
		return true;
	} catch (err) {
		return false;
	}
}

/**
 * Check if a permission flag matches another, taking into consideration wildcards, and other special keys.
 * 
 * @param required A required permission flag.
 * @param held A held permission flag.
 * @returns true if {@link held} matches {@link required}.
 */
function has(required: Model.Flag, held: Model.Flag): boolean {
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
function hasAll(required: Array<Model.Flag>, held: Array<Model.Flag>, returnMissing: boolean = false): Model.CheckResult {
	if (returnMissing) {
		const missing = required.filter(r => {
			return !held.some(h => { return has(r, h); });
		});
		return {
			passed: missing.length == 0,
			missing: missing
		};
	} else {
		return {
			passed: required.every(r => {
				return held.some(h => { return has(r, h); });
			}),
			missing: undefined
		};
	}
}

async function flattenUser(user: UserEntry): Promise<Array<Model.Flag>> {

	let flags = new Array<Model.Flag>();

	const roles = await Role.find({
		_id: {
			$in: user.roles
		}
	});
	const roleFlags = roles.flatMap(r => r.permissions);

	flags = flags.concat(flagArray(roleFlags, true, false));
	flags = flags.concat(flagArray(user.permissions, true, false));

	if (user.discord?.id) {
		const discordRoleIds = await getUserRoles(user.discord.id);
		const discordRoles = await Role.find({
			'discord.roles': {
				$in: discordRoleIds
			}
		}, {
			projections: {
				discord: 1,
				permissions: 1
			}
		});

		const discordFlags = discordRoles.flatMap(r => r.permissions);
		flags = flags.concat(flagArray(discordFlags, true, false));
	}

	return _.uniq(flags);
}

function flattenRole(role: RoleEntry): Array<Model.Flag> {

	const flags = new Array<Model.Flag>();

	role.permissions.forEach(p => {
		try {
			flags.push(Model.Flag.validate(p));
		} catch (e) { }
	});

	return _.uniq(flags);
}

function flagArray(perms: Array<string | Model.Flag>, ignoreInvalid: boolean = false, removeDuplicate: boolean = true): Array<Model.Flag> {
	const valid = new Array<Model.Flag>();
	for (const p of perms) {
		if (ignoreInvalid) {
			try {
				valid.push(Model.Flag.validate(p));
			} catch (e) { }
		} else {
			valid.push(Model.Flag.validate(p));
		}
	}
	return removeDuplicate ? _.uniq(valid) : valid;
}

async function checkPermissions(req: any, ...required: Array<string>): Promise<Model.CheckResult> {
	if (!req.__cache) req.__cache = {};
	if (!req.__cache.user) {
		const user = await User.findById(req.user.id);
		if (!user) throw new PermissionError(required);
		req.__cache.user = user;
	}
	if (!req.__cache.flags) {
		req.__cache.flags = await flattenUser(req.__cache.user);
	}
	const check = hasAll(flagArray(required), req.__cache.flags, true);
	if (check.passed)
		return check;
	else
		//@ts-ignore
		throw new PermissionError(check.missing);
}

export { PermissionError, has, hasAll, validFlag, flattenUser, flattenRole, flagArray, checkPermissions };