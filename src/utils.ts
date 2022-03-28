import mongoose from 'mongoose';
import { User } from './schemas/UserSchema.js';
import jsonwebtoken from 'jsonwebtoken';

const Types = mongoose.Types;

function stringToObjectIdArray(arr: Array<string>): Array<Types.ObjectId> {

    const final = new Array<Types.ObjectId>();

    for (const s of arr) {
        try {
            const o = new Types.ObjectId(s);
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

export { stringToObjectIdArray, unique, createToken };