import fetch, { Response } from 'node-fetch';

interface UserResponse {
	discordId: string;
	roles: Array<string>;
}

async function request(path: string): Promise<Response> {
	return fetch(`https://umapi.centralmind.net/api${path}`, {
		headers: {
			authorization: `Brearer ${process.env.UM_API_TOKEN}`
		}
	});
}

async function getUserRoles(userId: string): Promise<Array<string>> {
	const res = await request(`/users/${userId}`);
	const json: any = await res.json();
	return json.roles || [];
}

export { getUserRoles };