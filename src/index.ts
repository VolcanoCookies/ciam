import 'dotenv/config';
import express from 'express';
import sanitize from 'mongo-sanitize';
import mongoose from 'mongoose';
import RoleRouter from './routes/RoleRouter.js';

const app = express();

// Our own url, used for redirecting
const __url = process.env.IS_DEV ? 'http://localhost:10105/' : 'https://ciam.centralmind.net/';
const callbackUrl = encodeURIComponent(`${__url}callback`);

/*
interface AuthFlow {
	state: number;
	redirect: string;
}

const flows: Array<AuthFlow> = new Array;

function url(authFlow: AuthFlow, scope: string) {
	return `https://discord.com/api/oauth2/authorize?scope=${scope}&client_id=${process.env.CLIENT_ID}&redirect_url=${callbackUrl}/callback&state=${authFlow.state}`;
}

app.use('/callback', (req, res) => {
	if (!req.query.code) return res.status(401)


});
*/

const init = async () => {
	await mongoose.connect(process.env.DATABASE_URL!);
};

const url = "https://sso.isan.to/login?service=[redirURL]";

app.use(async (req, res, next) => {
	console.log(`${req.ip} | ${req.url}`);
	next();
});

app.use((req, res, next) => {
	req.body = sanitize(req.body);
	next();
});

app.use(express.json());

app.use('/login', (req, res) => {
	return res.redirect(`https://sso.isan.to/login?service=${callbackUrl}`);
});

app.use('/callback', async (req, res) => {
	const code = req.query.code;

	if (!code) return res.sendStatus(401);

	const dataRes = await fetch(`https://sso.isan.to/getuser/${code}`);
	const data = await dataRes.json();

	// TODO: Do something with this data idfk
});

app.use('/role', RoleRouter);

app.listen(process.env.PORT, async () => {
	await init();
	console.log(`Started CIAM on port ${process.env.PORT}`);
});