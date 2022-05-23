import {
	CheckResult,
	Flag,
	flagArray,
	PermissionError,
	PermissionHolder,
	PermissionHolderType,
	StrictFlag,
	unique,
} from 'ciam-commons';
import { getUserRoleIds } from './discord.js';
import { discordRoleModel } from './schemas/DiscordRoleSchema.js';
import { permissionInvocationModel } from './schemas/PermissionInvocationSchema.js';
import { roleModel } from './schemas/RoleSchema.js';
import { User, UserEntry, userModel } from './schemas/UserSchema.js';
import { minBy, UserRequest } from './utils.js';

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
export const has = (required: Flag | StrictFlag, held: Flag): boolean => {
	if (required.length === 0 || held.length === 0) return false;
	if (held.keys > required.keys) return false;
	for (let i = 0; i < required.keys.length; i++) {
		if (held.keys[i] === '*') return true;
		else if (held.keys[i] === '?') continue;
		else if (held.keys[i] !== required.keys[i]) return false;
	}
	return true;
};

/**
 * Check if a set of permission flags exist within another set of permission flags.
 *
 * Calls {@link has} to check if individual flags match.
 *
 * @param required permission flags to find within {@link held}.
 * @param held permission flags to look in.
 * @returns true if all flags in {@link required} have at least 1 flag in {@link held} that matches.
 */
/*
export const hasAll = (
	required: Flag[],
	held: Flag[],
	returnMissing: boolean = false,
	respectCooldown: boolean = true,
	invokeCooldown: boolean = true,
	respectLimit: boolean = true,
	invokeLimit: boolean = true
): CheckResult => {
	if (returnMissing) {
		const missing = required.filter((r) => {
			return !held.some((h) => {
				return has(r, h);
			});
		});

		return {
			passed: missing.length === 0,
			missing,
			onCooldown: undefined,
			cooldownExpires: undefined,
		};
	} else {
		return {
			passed: required.every((r) => {
				return held.some((h) => {
					return has(r, h);
				});
			}),
			missing: undefined,
			onCooldown: undefined,
			cooldownExpires: undefined,
		};
	}
};
*/

export interface CooldownCheck {
	onCooldown: boolean;
	cooldownExpires: number | undefined;
}

export const checkCooldown = async (
	user: User,
	heldFlag: Flag
): Promise<CooldownCheck> => {
	const invocations = await permissionInvocationModel.find({
		id: user._id,
		flag: heldFlag,
	});
	if (
		invocations.length > 0 &&
		heldFlag.hasLimit &&
		heldFlag.limit <= invocations.length
	)
		return {
			onCooldown: true,
			cooldownExpires: minBy(invocations, (i) =>
				i.expires.getTime()
			).expires.getTime(),
		};

	return { onCooldown: false, cooldownExpires: undefined };
};

/*
export const flattenUser = async (user: UserEntry): Promise<Flag[]> => {
	let flags = new Array<Flag>();

	const roles = await roleModel.find({
		_id: {
			$in: user.roles,
		},
	});
	const roleFlags = roles.flatMap((r) => r.permissions);

	flags = flags.concat(flagArray(roleFlags, true, false));
	flags = flags.concat(flagArray(user.permissions, true, false));

	if (user.discord?.id) {
		const discordRoleIds = await getUserRoles(user.discord.id);
		const discordRoles = await roleModel.find(
			{
				discord: {
					roles: {
						$in: discordRoleIds,
					},
				},
			},
			{
				projections: {
					discord: 1,
					permissions: 1,
				},
			}
		);

		const discordFlags = discordRoles.flatMap((r) => r.permissions);
		flags = flags.concat(flagArray(discordFlags, true, false));
	}

	return unique(flags);
};

export const flattenRole = (role: RoleEntry): Flag[] => {
	const flags = new Array<Flag>();

	role.permissions.forEach((p) => {
		try {
			flags.push(Flag.validate(p));
		} catch (e) {
			// Ignore errors
		}
	});

	return unique(flags);
};
*/

export const getPermissions = async (
	holder: PermissionHolder
): Promise<Flag[]> => {
	let flags = new Array<Flag>();

	const getUserPermissions = async (user: UserEntry): Promise<Flag[]> => {
		let flags = new Array<Flag>();

		flags = user.permissions.concat(await getRolePermissions(user.roles));

		if (user.discord?.id) {
			const discordRoleIds = getUserRoleIds(user.discord.id);
			const discordRoles = await roleModel.find(
				{
					'discord.roles': {
						$in: discordRoleIds,
					},
				},
				{
					projections: {
						permissions: 1,
					},
				}
			);

			const discordFlags = discordRoles.flatMap((r) => r.permissions);
			flags = flags.concat(discordFlags);
		}

		return flags;
	};

	const getRolePermissions = async (roleIds: string[]): Promise<Flag[]> => {
		if (roleIds.length === 0) return [];

		const roles = await roleModel.find(
			{
				_id: {
					$in: roleIds,
				},
			},
			{
				projection: {
					permissions: 1,
				},
			}
		);

		return roles.flatMap((r) => r.permissions);
	};

	switch (holder.type) {
		case PermissionHolderType.USER:
			{
				const user = await userModel.findById(holder.id);
				if (user === null) return [];

				flags = await getUserPermissions(user);
			}
			break;
		case PermissionHolderType.ROLE:
			{
				const role = await roleModel.findById(holder.id);
				if (role === null) return [];

				flags = role.permissions;
			}
			break;
		case PermissionHolderType.DISCORD_USER: {
			const user = await userModel.findOne({
				'discord.id': holder.id,
			});
			if (user === null) return [];

			flags = await getUserPermissions(user);
		}
		case PermissionHolderType.DISCORD_ROLE:
			const discordRole = await discordRoleModel.findById(holder.id);
			if (discordRole === null) return [];

			flags = discordRole.permissions;

			break;
		default:
			break;
	}
	return unique(flags);
};

const userFromHolder = async (
	holder: PermissionHolder
): Promise<User | undefined> => {
	switch (holder.type) {
		case PermissionHolderType.USER: {
			const user = await userModel.findById(holder.id);
			if (user === null) return undefined;
			else return user;
		}
		case PermissionHolderType.DISCORD_USER: {
			const user = await userModel.findOne({
				'discord.id': holder.id,
			});
			if (user === null) return undefined;
			else return user;
		}
		default: {
			return undefined;
		}
	}
};

// TODO: Add options to perform simpler checks in case the user does not care about cooldowns etc.
export const checkPermissions = async (
	holder: PermissionHolder,
	required: Flag[]
): Promise<CheckResult[]> => {
	const held = await getPermissions(holder);

	const user: User | undefined = await userFromHolder(holder);

	const heldSorted = held.sort(
		(a, b) => a.toString().length - b.toString().length
	);

	return await Promise.all(
		required.map(async (r) => {
			for (const h of heldSorted) {
				if (has(r, h)) {
					if (user !== undefined) {
						const { onCooldown, cooldownExpires } =
							await checkCooldown(user, h);
						return {
							flag: r,
							passed: true,
							onCooldown,
							cooldownExpires,
						};
					} else {
						return {
							flag: r,
							passed: true,
							onCooldown: false,
							cooldownExpires: undefined,
						};
					}
				}
			}
			return {
				flag: r,
				passed: false,
				onCooldown: false,
				cooldownExpires: undefined,
			};
		})
	);
};

export const assertPermissions = async (
	req: UserRequest,
	...required: string[]
) => {
	const checks = await checkPermissions(
		{ id: req.user._id.toHexString(), type: PermissionHolderType.USER },
		flagArray(required)
	);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	const missing = checks.filter((c) => !c.passed).map((c) => c.flag);
	if (missing.length === 0) return;
	else throw new PermissionError(missing);
};
