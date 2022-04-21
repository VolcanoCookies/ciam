import { flagRegex, strictFlagRegex } from 'ciam-commons';
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import jsonwebtoken from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from './schemas/UserSchema.js';

function stringToObjectIdArray(arr: Array<string>): Array<mongoose.Types.ObjectId> {

	const final = new Array<mongoose.Types.ObjectId>();

	for (const s of arr) {
		try {
			const o = new mongoose.Types.ObjectId(s);
			final.push(o);
		} catch (e) { }
	}

	return final;
};

const __url = process.env.IS_DEV ? 'http://localhost:10105' : 'https://ciamapi.centralmind.net';
const secret = process.env.JWT_SECRET as string;

function createToken(user: User): string {
	const payload = {
		id: user._id,
		type: user.type
	};

	const token = jsonwebtoken.sign(payload, secret, {
		issuer: __url
	});

	return token as string;
};

const flagValidator = function (arr: Array<string>) {
	return arr.every(f => f.match(flagRegex));
};

const strictFlagValidator = function (arr: Array<string>) {
	return arr.every(f => f.match(strictFlagRegex));
};

const validate = function (req: Request, res: Response, next: NextFunction) {
	const errors = validationResult(req);
	if (errors.isEmpty())
		next();
	else {
		res.status(400).send(errors);
	}
};

type AuthorizedRequest = Request & { user: User; };

export { stringToObjectIdArray, createToken, flagValidator, strictFlagValidator, validate, AuthorizedRequest };
