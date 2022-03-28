import express from 'express';
import { User } from '../schemas/UserSchema.js';
import fetch from 'node-fetch';
import { createToken } from '../utils.js';

const AuthRouter = express.Router();
// Our own url, used for redirecting
const __url = process.env.IS_DEV ? 'http://localhost:10105' : 'https://ciam.centralmind.net';
const secret = process.env.CLIENT_SECRET as string;

interface SSOResponse {
    id: string;
    username: string;
    avatar: string;
    discriminator: string;
    public_flags: number;
    flags: number;
    banner: string;
    accent_color: number;
    locale: string;
    mfa_enabled: boolean;
    premium_type: number;
    roles: {
        roles: Array<string>;
    };
    originalUrl: string;
}

AuthRouter.get('/login', (req, res) => {
    return res.redirect(`https://sso.isan.to/login?service=${__url}/callback`);
});

AuthRouter.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) return res.sendStatus(401);

    const dataRes = await fetch(`https://sso.isan.to/getuser/${code}`);
    const data = (await dataRes.json()) as SSOResponse;

    if (data.originalUrl != `${__url}/callback`) return res.sendStatus(401);

    const user = await User.findOne({ 'discord.id': data.id });

    if (!user) return res.sendStatus(401);

    res.send(createToken(user));
});

export { AuthRouter };