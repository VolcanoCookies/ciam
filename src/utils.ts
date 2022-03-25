import mongoose from 'mongoose';

export function stringToObjectIdArray(arr: Array<string>): Array<Types.ObjectId> {

    return arr.map(e => {
        try {
            return new mongoose.Types.ObjectId(e);
        } catch (e) {
            undefined;
        }
    }).filter(e => e);
};

export function unique<T>(arr: Array<T>): Array<T> {
    return arr.filter((v, i, a) => a.indexOf(v) === i);
}