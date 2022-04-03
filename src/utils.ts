import mongoose from 'mongoose';
import { User } from './schemas/UserSchema.js';
import jsonwebtoken from 'jsonwebtoken';
import { Check } from 'ciam-commons';
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';

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

function unique<T>(arr: Array<T>): Array<T> {
    return arr.filter((v, i, a) => a.indexOf(v) === i);
}

const __url = process.env.IS_DEV ? 'http://localhost:10105' : 'https://ciam.centralmind.net';
const secret = process.env.CLIENT_SECRET as string;

enum TokenType {
    USER = 0,
    BOT = 1
}

function createToken(user: User): string {
    const payload = {
        id: user._id,
        type: TokenType.USER
    };

    const token = jsonwebtoken.sign(payload, secret, {
        issuer: __url
    });

    return token as string;
};

function difference<T>(a: Array<T>, b: Array<T>): Array<T> {
    const arr = new Array<T>();
    for (const e of a) {
        if (!b.includes(e)) {
            arr.push(e);
        }
    }
    return arr;
}

const objectIdRegex = /[a-f0-9]{24}/;

const flagValidator = function (arr: Array<string>) {
    return arr.every(f => f.match(Check.flagRegex));
};

const strictFlagValidator = function (arr: Array<string>) {
    return arr.every(f => f.match(Check.strictFlagRegex));
};

const validate = function (req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (errors.isEmpty())
        next();
    else {
        res.status(400).send(errors);
    }
};

export { stringToObjectIdArray, unique, createToken, objectIdRegex, difference, flagValidator, strictFlagValidator, validate };