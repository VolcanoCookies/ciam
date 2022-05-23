import {
	difference,
	discordIdRegex,
	Flag,
	flagRegex,
	objectIdRegex,
} from 'ciam-commons';
import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { assertPermissions } from '../permission.js';
import { userModel } from '../schemas/UserSchema.js';
import {
	flagValidator,
	TypedQueryRequest,
	TypedRequest,
	validate,
} from '../utils.js';

const userRouter = express.Router();

userRouter.get('/me', (req, res) => {
	return res.status(200).send(req.user);
});

interface UserPost {
	name: string;
	roles?: string[];
	permissions?: Flag[];
	discord?: {
		id: string;
	};
}

userRouter.post(
	'/',
	body('name').exists().isString(),
	body('roles').optional().isArray(),
	body('permissions').optional().isArray().custom(flagValidator),
	body('discord.id').optional().matches(discordIdRegex),
	validate,
	async (req: TypedRequest<UserPost>, res: Response) => {
		const { name, roles, permissions, discord } = req.body;
		const id = discord?.id;

		if (permissions) {
			const required = permissions.map(
				(f) => `ciam.permission.grant.${f.toString()}`
			);
			await assertPermissions(req, ...required);
		}

		if (roles) {
			for (const r of roles)
				if (!req.user.roles.includes(r))
					return res.status(400).send('Missing role ' + r);
		}

		const user = new userModel({
			name,
			roles,
			permissions,
		});

		if (id)
			user.discord = {
				id,
			};

		const op = await user.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	}
);

interface UserPatch {
	_id: string;
	name?: string;
	roles?: string[];
	permissions?: Flag[];
}

userRouter.patch(
	'/',
	body('_id').matches(objectIdRegex),
	body('name').optional().isString(),
	body('roles').optional().isArray(),
	body('roles.*').matches(objectIdRegex),
	body('permissions').optional().isArray(),
	body('permissions.*').matches(flagRegex),
	validate,
	async (req: TypedRequest<UserPatch>, res: Response) => {
		const { _id, name, roles, permissions } = req.body;
		await assertPermissions(req, `ciam.user.update.${_id}`);

		const user = await userModel.findById(_id);

		if (user !== null) {
			if (permissions) {
				// Check if the user is allowed to give the provided permissions
				const added = difference(permissions, user.permissions);
				const removed = difference(user.permissions, permissions);

				const required = new Array<string>();
				added.forEach((p) =>
					required.push(`ciam.permission.grant.${p.toString()}`)
				);
				removed.forEach((p) =>
					required.push(`ciam.permission.revoke.${p.toString()}`)
				);

				await assertPermissions(req, ...required);
				user.permissions = permissions;
			}

			if (name !== undefined) user.name = name;

			if (roles !== undefined) {
				for (const r of roles)
					if (!req.user.roles.includes(r))
						return res.status(400).send('Missing role ' + r);
				user.roles = roles;
			}
		} else {
			return res.status(404).send('User not found');
		}

		const op = await user.save();
		if (!op) res.sendStatus(500);
		res.send(op);
	}
);

interface UserListGet {
	skip: number;
	limit: number;
}

userRouter.get(
	'/list',
	query('skip').default(0).isInt({ min: 0 }),
	query('limit').default(100).isInt({ min: 1, max: 100 }),
	validate,
	async (req: TypedQueryRequest<UserListGet>, res: Response) => {
		const { skip, limit } = req.query;

		await assertPermissions(req, `ciam.user.list`);

		const query = userModel.find({}).limit(limit).skip(skip);

		const op = await query;
		if (!op) return res.sendStatus(500);

		res.send(op);
	}
);

userRouter.get(
	'/:userId',
	param('userId').matches(objectIdRegex),
	validate,
	async (req: Request, res: Response) => {
		const userId = req.params.userId;
		await assertPermissions(req, `ciam.user.get.${userId}`);

		const op = await userModel.findOne({ _id: userId });
		if (!op) return res.status(404).send('User not found');
		res.send(op);
	}
);

userRouter.delete(
	'/:userId',
	param('userId').matches(objectIdRegex),
	validate,
	async (req: Request, res: Response) => {
		const userId = req.params.userId;
		await assertPermissions(req, `ciam.user.delete.${userId}`);

		if (userId === req.user._id.toHexString()) return res.sendStatus(400);

		const op = await userModel.findByIdAndDelete(userId);
		if (!op) return res.status(404).send('User not found');
		res.send(op);
	}
);

export { userRouter };
