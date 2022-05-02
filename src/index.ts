import chalk from 'chalk';
import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'express-jwt';
import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import sanitize from 'mongo-sanitize';
import mongoose from 'mongoose';
import { flattenUser } from './permission.js';
import { AuthRouter, PublicAuthRouter } from './routes/AuthRouter.js';
import { PermissionRouter } from './routes/PermissionRouter.js';
import { RoleRouter } from './routes/RoleRouter.js';
import { UserRouter } from './routes/UserRouter.js';
import { User, UserEntry, UserType } from './schemas/UserSchema.js';
import { jwtFromUser, validate } from './utils.js';
import cookieParser from 'cookie-parser';

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
		permissions: ['*'],
		type: UserType.SYSTEM
	};

	//@ts-ignore
	const systemUser: User = await User.findOneAndUpdate(filter, update, { upsert: true });
	log.info(`Upserted SYSTEM user with token "${jwtFromUser(systemUser)}"`);
};

const app = express();
const PublicRoutes = express.Router();
const PrivateRoutes = express.Router();

app.use(cors({
	origin: '*'
}));

app.use(jwt({
	secret: process.env.JWT_SECRET as string,
	algorithms: ['HS256'],
	requestProperty: 'auth'
}).unless({ path: ['/login', '/callback', '/confirm'] }));

app.use((req, res, next) => {
	req.body = sanitize(req.body);
	next();
});

app.use(express.json());

const cookieSecret = process.env.COOKIE_SECRET as string || process.exit(76);
app.use(cookieParser(cookieSecret));

app.use(async (req: Request, res: Response, next: NextFunction) => {
	//@ts-ignore
	const tokenId = req?.auth?.id;
	if (tokenId) {
		const user = await User.findById(tokenId);
		if (!user) return res.status(401).send('Invalid token');
		req.user = user as User;
		req.flags = await flattenUser(user as UserEntry);
	}
	next();
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	if (err.name === 'UnauthorizedError') {
		return res.status(401).send('invalid token');
	} else if (err) {
		log.error(err);
		return res.status(400);
	}
	next();
});

PrivateRoutes.use(async (req: Request, res, next) => {
	log.info(req.ip, '|', req.user._id.toString(), '|', req.method, req.url);
	next();
});

PublicRoutes.use(PublicAuthRouter);
PrivateRoutes.use('/auth', AuthRouter);
PrivateRoutes.use('/role', RoleRouter);
PrivateRoutes.use('/permission', PermissionRouter);
PrivateRoutes.use('/user', UserRouter);

app.use(PublicRoutes);
app.use(PrivateRoutes);

app.use(validate);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.log(err.name);
	if (err.name === 'PermissionError')
		res.status(401).send(err);
	else if (err) {
		log.error(err);
		res.sendStatus(400);
	}
});

app.listen(process.env.PORT, async () => {
	await init();
	log.info(`Started listening on port ${process.env.PORT}`);
	log.info(`Callback set to "${process.env.REDIRECT}"`);
});

export { app };
