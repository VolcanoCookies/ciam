import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import sanitize from 'mongo-sanitize';
import mongoose from 'mongoose';
import { PermissionRouter } from './routes/PermissionRouter.js';
import { RoleRouter } from './routes/RoleRouter.js';
import { AuthRouter } from './routes/AuthRouter.js';
import jwt from 'express-jwt';
import { UserRouter } from './routes/UserRouter.js';
import { User } from './schemas/UserSchema.js';
import log from 'loglevel';
import chalk from 'chalk';
import prefix from 'loglevel-plugin-prefix';

log.setLevel(process.env.IS_DEV ? log.levels.DEBUG : log.levels.INFO);

const colors = {
    TRACE: chalk.magenta,
    DEBUG: chalk.cyan,
    INFO: chalk.blue,
    WARN: chalk.yellow,
    ERROR: chalk.red,
};

prefix.reg(log);
log.enableAll();

prefix.apply(log, {
    format(level, name, timestamp) {
        //@ts-ignore
        return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level)} ${chalk.green(`${name}:`)}`;
    },
});

const init = async () => {
    await mongoose.connect(process.env.DATABASE_URL!);

    const filter = { _id: '000000000000000000000000' };
    const update = {
        name: 'SYSTEM',
        permissions: ['*']
    };

    await User.findOneAndUpdate(filter, update, { upsert: true });
    log.info('Upserted SYSTEM user');
};

const app = express();

app.use(jwt({
    secret: process.env.CLIENT_SECRET as string,
    algorithms: ['HS256']
}).unless({ path: ['/login', '/callback'] }));

app.use((req, res, next) => {
    req.body = sanitize(req.body);
    next();
});

app.use(express.json());

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).send('invalid token');
    } else if (err) {
        log.error(err);
        return res.status(400);
    }
    next();
});

app.use(AuthRouter);

app.use(async (req, res, next) => {
    //@ts-ignore
    log.info(req.ip, '|', req.user.id, '|', req.method, req.url);
    next();
});

app.use('/role', RoleRouter);
app.use('/permission', PermissionRouter);
app.use('/user', UserRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.log(err.name);
    if (err.name === 'PermissionError')
        res.status(401).send(err.message);
    else if (err) {
        log.error(err);
        res.sendStatus(400);
    }
});

app.listen(process.env.PORT, async () => {
    await init();
    log.info(`Started listening on port ${process.env.PORT}`);
});

export { app };