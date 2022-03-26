import mongoose, { Types } from 'mongoose';

export function stringToObjectIdArray(arr: Array<string>): Array<Types.ObjectId> {

    const final = new Array<Types.ObjectId>();

    for (const s of arr) {
        try {
            const o = new Types.ObjectId(s);
            final.push(o);
        } catch (e) { }
    }

    return final;
};

export function unique<T>(arr: Array<T>): Array<T> {
    return arr.filter((v, i, a) => a.indexOf(v) === i);
}