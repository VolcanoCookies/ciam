import { User, UserEntry } from './schemas/UserSchema.js';
import { Role, RoleEntry } from './schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import _ from 'lodash';
import { Request, Response, NextFunction } from 'express';
import { Check, Model } from 'ciam-commons';

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
    constructor(missing: Array<string> | Array<Flag> | undefined) {
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
function hasAll(required: Array<Flag>, held: Array<Flag>, returnMissing: boolean = false): Model.CheckResult {
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

    const flags = new Array<Flag>();

    user = await user.populate<{ roles: Types.Array<Role>; }>('roles', 'permissions');

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

function flattenRole(role: RoleEntry): Array<Flag> {

    const flags = new Array<Flag>();

    role.permissions.forEach(p => {
        try {
            flags.push(Flag.validate(p));
        } catch (e) { }
    });

    return _.uniq(flags);
}

function flagArray(perms: Array<string | Flag>, ignoreInvalid: boolean = false, removeDuplicate: boolean = true): Array<Flag> {
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
        throw new PermissionError(check.missing);
}

// Middleware function
const permissions = async function (req: Request, res: Response, next: NextFunction) {

};

export { Flag, PermissionError, has, hasAll, validFlag, flattenUser, flattenRole, flagArray, checkPermissions, permissions };