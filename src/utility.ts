import fetch, { Response } from 'node-fetch';
import { UM_API_TOKEN } from './config.js';

const request = async (path: string): Promise<Response> => {
	return fetch(`https://umapi.centralmind.net/api${path}`, {
		headers: {
			authorization: `Bearer ${UM_API_TOKEN}`,
		},
	});
};

export const getUserRoles = async (userId: string): Promise<string[]> => {
	return request(`/users/${userId}`)
		.then((res) => res.json())
		.then((json: any) => json.roles)
		.catch((err) => new Array<string>());
};
