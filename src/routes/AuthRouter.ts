import { flag, objectIdRegex } from 'ciam-commons';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { header, param, query } from 'express-validator';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import {
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	REDIRECT,
} from '../config.js';
import { assertPermissions } from '../permission.js';
import {
	AccessToken,
	AuthRequest,
	IdentifyData,
} from '../schemas/AuthSchema.js';
import {
	DiscordUser,
	User,
	UserEntry,
	userModel,
} from '../schemas/UserSchema.js';
import { dateIn } from '../utils.js';

const authRouter = express.Router();
const publicAuthRouter = express.Router();

/**
 *
 * OAuth
 *
 * 1. Website makes post request with the auth flow it wants to create.
 * 2. CIAM return the one time url to that auth flow
 * 3. Website redirects the user to that url
 * 4. User sees what service is asking for what permissions
 * 5. User confirms and gets sent to discord.
 * 6. User returns and ciam redirects it back to service together with code.
 * 7. Code can be used to get an access token that works like a regular jwt token for that subset of permissions the service requested.
 *
 * CIAM also sets cookies for entire centralmind.net domain so that any service can identify an user without having them login.
 *
 * Websites can also do a simpler version that only sets the cookie to identify the user if they don't need any perms from them.
 *
 */

const createIdentifyData = async (
	user: User,
	redirect: string
): Promise<IdentifyData> => {
	const code = crypto.randomUUID();
	const data = await new IdentifyData({
		redirect,
		userId: user._id,
		code,
		createdAt: Date.now(),
		expiresAt: dateIn(60 * 15),
	}).save();
	return data;
};

interface IdentifyDataResponse {
	code: string;
	redirect: string;
	user: PartialUser;
}

interface PartialUser {
	_id: string;
	name: string;
	avatar: string;
	// TODO: Why are there 2 different DiscordUser types? One in this project and one in ciam-commons
	discord: DiscordUser;
}

const getResponseFromIdentifyData = async (
	data: IdentifyData
): Promise<IdentifyDataResponse | undefined> => {
	const user = await userModel.findById(data.userId);
	if (!user) return undefined;

	const response: IdentifyDataResponse = {
		code: data.code,
		redirect: data.redirect,
		user: {
			_id: user._id.toHexString(),
			name: user.name,
			avatar: user.avatar,
			discord: user.discord,
		},
	};

	return response;
};

/* publicAuthRouter.get(
	'/login/identify',
	query('redirect').isString().exists().isURL(),
	async (req: Request, res: Response) => {
		const redirect = req.query.redirect as string;

		// If user has already identifies with ciam before
		const userId = req.signedCookies['ciam_identify'];
		if (userId) {
			const user = await userModel.findById(userId);
			if (user) {
				const data = await createIdentifyData(user, redirect);
				return res.redirect(`${data.redirect}?code=${data.code}`);
			} else {
				res.clearCookie('ciam_identify');
			}
		}

		const state = crypto.randomUUID();

		res.cookie('identify_state', state, {
			maxAge: 15 * 60 * 1000,
			signed: true,
		});
		res.cookie('identify_redirect', redirect, {
			maxAge: 15 * 60 * 1000,
			signed: true,
		});
		return res.redirect(
			`https://discord.com/api/oauth2/authorize?response_type=code&client_id=${DISCORD_CLIENT_ID}&scope=identify&redirect_url=${REDIRECT}/identify&state=${request.stateId}`
		);
	}
); */

/* publicAuthRouter.get(
	'/callback/identify',
	query('code').exists().isString(),
	query('state').exists().isString(),
	async (req: Request, res: Response) => {
		// Discords code
		const code = req.query.code as string;

		const state = req.signedCookies['identify_state'];
		const redirect = req.signedCookies['identify_redirect'];

		if (!state || !redirect) {
			return res.status(400).send('Bad state');
		}

		const token = await requestAccessToken(code);
		if (!token) return res.status(400);
		const data = await requestDiscordData(token);
		if (!data) return res.status(400);

		let user = await userModel.findOne({ 'discord.id': data.id });
		if (!user) user = await createUserFromDiscordData(data);

		res.cookie('ciam_identify', user._id, {
			expires: new Date(Date.now() + 3600 * 24 * 7),
			signed: true,
			domain: process.env.DEV ? 'localhost' : 'ciamapi.centralmind.net',
			secure: true,
			// TODO: Security vulnerability to have it lax?
			sameSite: 'strict',
		});

		const identifyData = await createIdentifyData(user, redirect);
		return res.redirect(
			`${identifyData.redirect}?code=${identifyData.code}`
		);
	}
); */
/*
authRouter.get(
	'/identify/:code',
	param('code').exists().isString().isUUID(),
	async (req: Request, res: Response) => {
		const code = req.params.code;

		const data = await IdentifyData.findOne({ code });
		if (!data) return res.status(400).send('Invalid code');

		const responseData = await getResponseFromIdentifyData(data);
		if (!responseData) return res.status(400).send('User not found');

		res.send(responseData);
		data.delete();
	}
);

publicAuthRouter.get(
	'/login',
	query('returnUrl').isString().exists().isURL(),
	query('domain').isString().exists().isURL(),
	query('scope')
		.isArray()
		.exists()
		.custom((v: string[]) => {
			return v.forEach((f) => flag(f));
		}),
	query('client').isString().exists().matches(objectIdRegex),
	async (req: Request, res: Response) => {
		const { returnUrl, domain, scope, clientId } = req.query;

		const client = await userModel.findOne({ _id: clientId });
		// Change this to redirect back?
		if (!client) return res.status(400).send('Invalid client id');

		// Expire in 15 minutes
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

		const authRequest = new AuthRequest({
			scope,
			redirect: returnUrl,
			domain,
			expiresAt,
			state: 'request',
			stateId: crypto.randomUUID(),
			client,
		});

		await authRequest.save();

		return res.redirect(
			`https://discord.com/api/oauth2/authorize?response_type=code&client_id=${DISCORD_CLIENT_ID}&scope=identify&redirect_url=${REDIRECT}&state=${authRequest.state}`
		);
	}
);


publicAuthRouter.get(
	'/confirm',
	query('stateId').isString().exists(),
	async (req: Request, res: Response) => {
		const stateId = req.query.stateId;

		const auth = await AuthRequest.findOne({
			stateId,
			state: 'request',
		});
		if (!auth) return res.sendStatus(401);

		auth.state = 'pending';
		await auth.save();

		return res.redirect(
			`https://discord.com/api/oauth2/authorize?response_type=code&client_id=${DISCORD_CLIENT_ID}&scope=identify&redirect_url=${auth.callback}&state=${auth.stateId}`
		);
	}
);

publicAuthRouter.get(
	'/callback',
	query('code').exists().isString(),
	query('state').exists().isString(),
	async (req: Request, res: Response) => {
		// Discords code
		const code = req.query.code as string;
		// Ciam auth request reference code
		const state = req.query.state as string;

		const auth = await AuthRequest.findOne({
			stateId: state,
			state: 'pending',
		});
		if (!auth) return res.status(400).send('Bad code');
		auth.delete();

		const token = await requestAccessToken(code);
		if (!token) return res.status(400);
		const data = await requestDiscordData(token);
		if (!data) return res.status(400);

		let user = await userModel.findOne({ 'discord.id': data.id });
		if (!user) user = await createUserFromDiscordData(data);

		const tokenExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
		const refreshTokenExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

		const accessToken = await new AccessToken({
			scope: auth.scope,
			token: crypto.randomUUID(),
			refreshToken: crypto.randomUUID(),
			subject: user,
			client: auth.client,
			tokenExpiresAt,
			refreshTokenExpiresAt,
		}).save();

		res.cookie('ciam_access_token', accessToken.token, {
			expires: tokenExpiresAt,
			signed: true,
			domain: auth.domain,
			secure: true,
			sameSite: 'lax',
		});
		res.cookie('ciam_refresh_token', accessToken.refreshToken, {
			expires: refreshTokenExpiresAt,
			signed: true,
			domain: auth.domain,
			secure: true,
			sameSite: 'lax',
		});

		res.redirect(auth.redirect);
	}
);

authRouter.get(
	'/user',
	header('ciam_token').isString().exists(),
	async (req: Request, res: Response) => {
		const token = req.headers['ciam_token'];
		const accessToken = await AccessToken.findOne({
			token,
			client: req.user._id,
		});
		if (!accessToken) return res.status(400).send('invalid token');

		let data: any;
		switch (accessToken.scope) {
			case 'identify': {
				const subject = await userModel.findOne({
					_id: accessToken.subject,
				});
				if (!subject) return res.status(400).send('bad subject');
				data = {
					id: subject.id,
					username: subject.name,
					discord: subject.discord,
				};
				break;
			}
		}

		return res.send(data);
	}
);

authRouter.get(
	'/refresh',
	query('refreshToken').isString().exists(),
	async (req: Request, res: Response) => {
		checkPermissions(req, 'ciam.auth.refresh');

		const refreshToken = req.query.refreshToken;
		const accessToken = await AccessToken.findOne({
			refreshToken,
			client: req.user._id,
		});

		if (!accessToken) return res.status(400).send('Invalid refresh token');

		const tokenExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
		const refreshTokenExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

		const newAccessToken = await new AccessToken({
			scope: accessToken.scope,
			token: crypto.randomUUID(),
			refreshToken: crypto.randomUUID(),
			subject: accessToken.subject,
			client: accessToken.client,
			createdAt: Date.now(),
			tokenExpiresAt,
			refreshTokenExpiresAt,
		}).save();

		if (!newAccessToken) return res.sendStatus(500);
		await accessToken.delete();

		res.send({
			token: newAccessToken.token,
			refreshToken: newAccessToken.refreshToken,
			tokenExpiresAt: newAccessToken.tokenExpiresAt,
			refreshTokenExpiresAt: newAccessToken.refreshTokenExpiresAt,
		});
	}
);
*/
const createUserFromDiscordData = async (
	data: DiscordData
): Promise<UserEntry> => {
	const user = await new userModel({
		name: `${data.username}#${data.discriminator}`,
		avatar: data.avatar,
		discord: {
			id: data.id,
			username: data.username,
			discriminator: data.discriminator,
		},
	}).save();
	return user;
};

const requestAccessToken = async (
	code: string
): Promise<string | undefined> => {
	const data = await fetch('https://discord.com/api/v8/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: DISCORD_CLIENT_ID,
			client_secret: DISCORD_CLIENT_SECRET,
			grant_type: 'authorization_code',
			code: code,
			redirect_url: REDIRECT,
		}),
	});
	const json: any = await data.json();
	return json['access_token'];
};

interface DiscordData {
	id: string;
	username: string;
	discriminator: string;
	avatar: string;
	verified: boolean;
	flags: number;
	banner: string;
	accent_color: number;
	premium_type: number;
	public_flags: number;
}

const requestDiscordData = async (
	accessToken: string
): Promise<DiscordData | undefined> => {
	const data = await fetch('http://discordapp.com/api/users/@me', {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	const json: any = await data.json();
	return json['id'] ? json : undefined;
};

export { authRouter, publicAuthRouter };
