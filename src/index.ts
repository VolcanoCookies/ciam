import chalk from 'chalk';
import { Flag, PermissionHolderType } from 'ciam-commons';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'express-jwt';
import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import sanitize from 'mongo-sanitize';
import mongoose from 'mongoose';
import {
	COOKIE_SECRET,
	DATABASE_URL,
	JWT_SECRET,
	LOG_LEVEL,
	PORT,
	REDIRECT,
} from './config.js';
import { getPermissions } from './permission.js';
import { authRouter, publicAuthRouter } from './routes/AuthRouter.js';
import { permissionRouter } from './routes/PermissionRouter.js';
import { roleRouter } from './routes/RoleRouter.js';
import { userRouter } from './routes/UserRouter.js';
import { User, UserEntry, userModel, UserType } from './schemas/UserSchema.js';
import { jwtFromUser, validate } from './utils.js';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
log.setDefaultLevel(LOG_LEVEL);

const colors = {
	TRACE: chalk.magenta,
	DEBUG: chalk.cyan,
	INFO: chalk.blue,
	WARN: chalk.yellow,
	ERROR: chalk.red,
};

prefix.reg(log);

prefix.apply(log, {
	format(level, name, timestamp) {
		//@ts-ignore
		return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](
			level
		)} ${chalk.green(`${name}:`)}`;
	},
});

const init = async () => {
	await mongoose.connect(DATABASE_URL);

	const systemUser = await userModel.findOneAndUpdate(
		{ _id: '000000000000000000000000' },
		{
			name: 'SYSTEM',
			permissions: ['*'],
			type: UserType.SYSTEM,
		},
		{
			upsert: true,
		}
	);

	if (systemUser === null) {
		log.error('System user not found, exiting');
		process.exit(3);
	}

	log.info(`Upserted SYSTEM user with token "${jwtFromUser(systemUser)}"`);

	log.info(`Started listening on port ${PORT}`);
	log.info(`Callback set to "${REDIRECT}"`);
};

const app = express();
const privateRoutes = express.Router();
const publicRoutes = express.Router();

app.use(
	cors({
		origin: '*',
	})
);

app.use(
	jwt({
		secret: JWT_SECRET,
		algorithms: ['HS256'],
		requestProperty: 'auth',
	}).unless({ path: ['/login', '/callback', '/confirm'] })
);

app.use((req: Request, res, next) => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	req.body = sanitize(req.body);
	next();
});

app.use(express.json());

app.use(cookieParser(COOKIE_SECRET));

app.use(
	async (
		req: Request & { auth?: { id?: string } },
		res: Response,
		next: NextFunction
	) => {
		const tokenId = req?.auth?.id;
		if (tokenId) {
			const user = await userModel.findById(tokenId);
			if (user === null) return res.status(401).send('Invalid token');
			req.user = user as User;
			req.flags = await getPermissions({
				id: user._id.toHexString(),
				type: PermissionHolderType.USER,
			});
		}
		next();
	}
);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	if (err.name === 'UnauthorizedError') {
		return res.status(401).send('invalid token');
	} else if (err) {
		log.error(err);
		return res.status(400);
	}
	next();
});

publicRoutes.use(async (req: Request, res, next) => {
	log.info(req.ip, '|', req.user._id.toString(), '|', req.method, req.url);
	next();
});

privateRoutes.use(publicAuthRouter);
publicRoutes.use('/auth', authRouter);
publicRoutes.use('/role', roleRouter);
publicRoutes.use('/permission', permissionRouter);
publicRoutes.use('/user', userRouter);

app.use(privateRoutes);
app.use(publicRoutes);

app.use(validate);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	if (err.name === 'PermissionError') res.status(401).send(err);
	else if (err) {
		log.error(err);
		res.sendStatus(400);
	}
});

app.listen(PORT, () => {
	void init();
});

export { app };
