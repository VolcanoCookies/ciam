import mongoose from 'mongoose';
import { User } from './schemas/UserSchema.js';
import jsonwebtoken from 'jsonwebtoken';

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

const objectIdRegex = /[a-f0-9]{24}/;

export { stringToObjectIdArray, unique, createToken, objectIdRegex };