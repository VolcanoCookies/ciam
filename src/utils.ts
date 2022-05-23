import {
	Flag,
	flagRegex,
	isPermissionHolder,
	strictFlagRegex,
} from 'ciam-commons';
import { NextFunction, Request, Response } from 'express';
import {
	body,
	CustomValidator,
	oneOf,
	validationResult,
} from 'express-validator';
import jsonwebtoken from 'jsonwebtoken';
import mongoose from 'mongoose';
import { IS_DEV, JWT_SECRET } from './config.js';
import { AccessToken } from './schemas/AuthSchema.js';
import { User } from './schemas/UserSchema.js';

export const stringToObjectIdArray = (
	arr: string[]
): mongoose.Types.ObjectId[] => {
	const final = new Array<mongoose.Types.ObjectId>();

	for (const s of arr) {
		try {
			const o = new mongoose.Types.ObjectId(s);
			final.push(o);
		} catch (e) {
			// Ignore error
		}
	}

	return final;
};

export const __url = IS_DEV
	? 'http://localhost:10105'
	: 'https://ciamapi.centralmind.net';

export const jwtFromUser = (user: User): string => {
	const payload = {
		id: user._id,
		type: 'user',
	};

	const token = jsonwebtoken.sign(payload, JWT_SECRET, {
		issuer: __url,
	});

	return token;
};

export const jwtFromAccessToken = (token: AccessToken): string => {
	const payload = {
		id: token.token,
		type: 'token',
	};

	return jsonwebtoken.sign(payload, JWT_SECRET, {
		issuer: __url,
	});
};

export const flagValidator = (arr: string[]) => {
	return arr.every((f) => f.match(flagRegex));
};

export const strictFlagValidator = (arr: string[]) => {
	return arr.every((f) => f.match(strictFlagRegex));
};

export const validate = (req: Request, res: Response, next: NextFunction) => {
	const errors = validationResult(req);
	if (errors.isEmpty()) next();
	else {
		res.status(400).send(errors);
	}
};

export const dateIn = (futureSec: number): Date => {
	return new Date(Date.now() + futureSec);
};

export type AuthorizedRequest = Request & { user: User };

export interface UserRequest extends Request {
	user: User;
}

export interface TypedRequest<T> extends UserRequest {
	body: T;
	user: User;
}

export interface TypedQueryRequest<T> extends UserRequest {
	query: qs.ParsedQs & T;
	user: User;
}

export const bodyHasAny = (...fields: string[]) => {
	return oneOf(fields.map((name) => body(name).exists()));
};

export const validatePermissionHolder: CustomValidator = (value: unknown) => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	if (isPermissionHolder(value)) return value;
	else throw new Error('Invalid permission holder');
};

export const minBy = <T>(arr: T[], trans: (arg0: T) => number): T => {
	if (arr.length === 0) throw new Error('Empty array');
	let minElm: T = arr[0];
	let minVal = Infinity;
	arr.forEach((elm) => {
		const posMin = trans.apply(undefined, [elm]);
		if (posMin < minVal) {
			minElm = elm;
			minVal = posMin;
		}
	});
	return minElm;
};

export const maxBy = <T>(arr: T[], trans: (arg0: T) => number): T => {
	if (arr.length === 0) throw new Error('Empty array');
	let maxElm: T = arr[0];
	let maxVal = -Infinity;
	arr.forEach((elm) => {
		const posMax = trans.apply(undefined, [elm]);
		if (posMax < maxVal) {
			maxElm = elm;
			maxVal = posMax;
		}
	});
	return maxElm;
};

export const flagSetter = (flag: Flag | string): string => {
	const f = Flag.validate(flag);
	return f.keys.join('.');
};

export const flagGetter = (v: string): Flag => {
	return Flag.validate(v);
};
