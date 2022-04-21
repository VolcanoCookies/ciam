import { CheckResult, Flag, flagArray } from 'ciam-commons';
import _ from 'lodash';
import { Role, RoleEntry } from './schemas/RoleSchema.js';
import { UserEntry } from './schemas/UserSchema.js';
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
function hasAll(required: Array<Flag>, held: Array<Flag>, returnMissing: boolean = false): CheckResult {
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

async function flattenUser(user: UserEntry): Promise<Array<Flag>> {

	let flags = new Array<Flag>();

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

function flattenRole(role: RoleEntry): Array<Flag> {

	const flags = new Array<Flag>();

	role.permissions.forEach(p => {
		try {
			flags.push(Flag.validate(p));
		} catch (e) { }
	});

	return _.uniq(flags);
}

async function checkPermissions(req: any, ...required: Array<string>): Promise<CheckResult> {
	const check = hasAll(flagArray(required), req.flags, true);
	if (check.passed)
		return check;
	else
		//@ts-ignore
		throw new PermissionError(check.missing);
}

export { has, hasAll, flattenUser, flattenRole, checkPermissions };

