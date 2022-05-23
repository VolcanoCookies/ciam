import 'dotenv/config';

const getEnv = (name: string): string => {
	const val = process.env[name];
	if (val === undefined) {
		// eslint-disable-next-line no-console
		console.error(`Env var ${name} is undefined`);
		process.exit(7);
	}
	return val;
};

export const PORT = getEnv('PORT');
export const REDIRECT = getEnv('REDIRECT');
export const IS_DEV = getEnv('IS_DEV') === 'true';
export const DATABASE_URL = getEnv('DATABASE_URL');
export const JWT_SECRET = getEnv('JWT_SECRET');
export const COOKIE_SECRET = getEnv('COOKIE_SECRET');
export const UM_API_TOKEN = getEnv('UM_API_TOKEN');
export const DISCORD_CLIENT_ID = getEnv('DISCORD_CLIENT_ID');
export const DISCORD_CLIENT_SECRET = getEnv('DISCORD_CLIENT_SECRET');
export const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
export const DISCORD_TOKEN = getEnv('DISCORD_TOKEN');
export const UNIT_TEST = process.env.UNIT_TEST === 'true';
