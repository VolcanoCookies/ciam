import { objectIdRegex } from 'ciam-commons';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { header, query } from 'express-validator';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { checkPermissions } from '../permission.js';
import { AccessToken, AuthRequest } from '../schemas/AuthSchema.js';
import { User, UserEntry } from '../schemas/UserSchema.js';

const AuthRouter = express.Router();
const PublicAuthRouter = express.Router();
// Our own url, used for redirecting
const callback = process.env.REDIRECT as string;
const secret = process.env.CLIENT_SECRET as string;

const clientId = process.env.DISCORD_CLIENT_ID as string;
const clientSecret = process.env.DISCORD_CLIENT_SECRET as string;

/**
 * 
 * SSO Idea
 * 
 * 1. Website redirects to ciam, ciam redirects to sso/discord.'
 * 2. User returns to ciam, then is redirected back to where he was sent from together with a code.
 * 3. Code can be used to retrieve a token that is used to get whatever info the user authorized.
 * 4. Token expires in X time, a refresh token can be used to generate a new code.
 * 
 * These codes can be used to prove the identity of someone, and they are unique to applications.
 * 
 * 
 */

const scopes = ['identify'];

PublicAuthRouter.get('/login',
	query('returnUrl').isString().exists().isURL(),
	query('domain').isString().exists().isURL(),
	query('scope').isString().exists().bail().custom((s: string) => {
		return scopes.includes(s);
	}),
	query('client').isString().exists().matches(objectIdRegex),
	async (req: Request, res: Response) => {
		const returnUrl = req.query.returnUrl;
		const domain = req.query.domain;
		const scope = req.query.scope;
		const clientId = req.query.client;

		const client = await User.findOne({ _id: clientId });
		// Change this to redirect back?
		if (!client) return res.status(400).send('Invalid client id');

		// Expire in 15 minutes
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

		const authRequest = new AuthRequest({
			scope: scope,
			redirect: returnUrl,
			domain: domain,
			expiresAt: expiresAt,
			state: crypto.randomUUID(),
			client: client
		});

		await authRequest.save();

		return res.redirect(`https://discord.com/api/oauth2/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&scope=identify&redirect_url=${callback}&state=${authRequest.state}`);
	});

PublicAuthRouter.get('/callback',
	query('code').exists().isString(),
	query('state').exists().isString(),
	async (req: Request, res: Response) => {
		// Discords code
		const code = req.query.code as string;
		// Ciam auth request reference code
		const state = req.query.state as string;

		const auth = await AuthRequest.findOne({ state: state });
		if (!auth) return res.status(400).send('Bad code');

		const token = await requestAccessToken(code);
		if (!token) return res.status(400);
		const data = await requestDiscordData(token);
		if (!data) return res.status(400);

		let user = await User.findOne({ 'discord.id': data.id });
		if (!user) user = await createUserFromDiscordData(data);

		const tokenExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
		const refreshTokenExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

		const accessToken = await new AccessToken({
			scope: auth.scope,
			token: crypto.randomUUID(),
			refreshToken: crypto.randomUUID(),
			subject: user,
			client: auth.client,
			tokenExpiresAt: tokenExpiresAt,
			refreshTokenExpiresAt: refreshTokenExpiresAt
		}).save();

		res.cookie('ciam_access_token', accessToken.token, {
			expires: tokenExpiresAt,
			signed: true,
			domain: auth.domain,
			secure: true,
			sameSite: 'lax'
		});
		res.cookie('ciam_refresh_token', accessToken.refreshToken, {
			expires: refreshTokenExpiresAt,
			signed: true,
			domain: auth.domain,
			secure: true,
			sameSite: 'lax'
		});

		res.redirect(auth.redirect);
	});

AuthRouter.get('/user',
	header('ciam_token').isString().exists(),
	async (req: Request, res: Response) => {

		const token = req.headers['ciam_token'];
		const accessToken = await AccessToken.findOne({ token: token, client: req.user._id });
		if (!accessToken) return res.status(400).send('invalid token');


		let data: any;
		switch (accessToken.scope) {
			case 'identify': {
				const subject = await User.findOne({ _id: accessToken.subject });
				if (!subject) return res.status(400).send('bad subject');
				data = {
					id: subject.id,
					username: subject.name,
					discord: subject.discord
				};
				break;
			}
		}

		return res.send(data);
	});

AuthRouter.get('/refresh',
	query('refreshToken').isString().exists(),
	async (req: Request, res: Response) => {
		await checkPermissions(req, 'ciam.auth.refresh');

		const refreshToken = req.query.refreshToken;
		const accessToken = await AccessToken.findOne({ refreshToken: refreshToken, client: req.user._id });

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
			tokenExpiresAt: tokenExpiresAt,
			refreshTokenExpiresAt: refreshTokenExpiresAt
		}).save();

		if (!newAccessToken) return res.sendStatus(500);
		await accessToken.delete();

		res.send({
			token: newAccessToken.token,
			refreshToken: newAccessToken.refreshToken,
			tokenExpiresAt: newAccessToken.tokenExpiresAt,
			refreshTokenExpiresAt: newAccessToken.refreshTokenExpiresAt
		});

	});

async function createUserFromDiscordData(data: DiscordData): Promise<UserEntry> {
	const user = await new User({
		name: `${data.username}#${data.discriminator}`,
		avatar: data.avatar,
		discord: {
			id: data.id,
			username: data.username,
			discriminator: data.discriminator
		}
	}).save();
	return user;
}

async function requestAccessToken(code: string): Promise<string | undefined> {
	const data = await fetch(('https://discord.com/api/v8/oauth2/token'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			'client_id': clientId,
			'client_secret': clientSecret,
			'grant_type': 'authorization_code',
			'code': code,
			'redirect_url': callback
		})
	});
	const json: any = await data.json();
	return json['access_token'];
}

interface DiscordData {
	id: string,
	username: string,
	discriminator: string,
	avatar: string,
	verified: boolean,
	flags: number,
	banner: string,
	accent_color: number,
	premium_type: number,
	public_flags: number;
}

async function requestDiscordData(accessToken: string): Promise<DiscordData | undefined> {
	const data = await fetch('http://discordapp.com/api/users/@me', {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	const json: any = await data.json();
	return json['id'] ? json : undefined;
}

export { AuthRouter, PublicAuthRouter };

