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
	return request(`/users/${userId}`).then(res => res.json())
		.then((json: any) => json.roles)
		.catch(err => new Array());
}

export { getUserRoles };