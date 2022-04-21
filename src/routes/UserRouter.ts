import { objectIdRegex } from 'ciam-commons/Check';
import { difference } from 'ciam-commons/Utils';
import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { checkPermissions } from '../permission.js';
import { User } from '../schemas/UserSchema.js';
import { flagValidator } from '../utils.js';

const UserRouter = express.Router();

UserRouter.get('/me', (req, res) => {
	return res.status(200).send(req.user);
});

UserRouter.post('/create',
	body('name').exists().isString(),
	body('roles').optional().isArray(),
	body('permissions').optional().isArray().custom(flagValidator),
	async (req, res) => {
		const { name, roles, permissions, discord } = req.body;
		const id = discord?.id;

		if (permissions) {
			//@ts-ignore
			const required = permissions.map(f => `ciam.permission.grant.${f}`);
			await checkPermissions(req, ...required);
		}

		if (roles) {
			for (const r of roles)
				if (!req.user.roles.includes(r))
					return res.status(400).send('Missing role ' + r);
		}

		const user = new User({
			name: name,
			roles: roles,
			permissions: permissions
		});

		if (id)
			//@ts-ignore
			user.discord = { id: id };

		const op = await user.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	});

UserRouter.post('/update',
	body('_id').exists().isString(),
	body('name').optional().notEmpty(),
	body('roles').optional().isArray(),
	body('permissions').optional().isArray().custom(flagValidator),
	async (req, res) => {
		const { _id, name, roles, permissions } = req.body;
		await checkPermissions(req, `ciam.user.update.${_id}`);

		const user = await User.findById(_id);
		if (!user) return res.status(404).send('User not found');

		if (permissions) {
			// Check if the user is allowed to give the provided permissions
			const added = difference(permissions, user.permissions);
			const removed = difference(user.permissions, permissions);

			const required = new Array();
			added.forEach(p => required.push(`ciam.permission.grant.${p}`));
			removed.forEach(p => required.push(`ciam.permission.revoke.${p}`));

			await checkPermissions(req, ...required);
			user.permissions = permissions;
		}
		if (name)
			user.name = name;
		if (roles) {
			for (const r of roles)
				if (!req.user.roles.includes(r))
					return res.status(400).send('Missing role ' + r);
			user.roles = roles;
		}

		const op = await user.save();
		if (!op) res.sendStatus(500);
		res.send(op);
	});

UserRouter.get('/list',
	query('skip').isInt({ min: 0 }).default(0),
	query('limit').isInt({ min: 1, max: 100 }).default(100),
	async (req: Request, res: Response) => {
		//@ts-ignore
		const { skip, limit } = req.query as { skip: number, limit: number; };

		await checkPermissions(req, `ciam.user.list`);

		let query = User.find({})
			.limit(limit)
			.skip(skip);

		const op = await query;
		if (!op) return res.sendStatus(500);

		res.send(op);
	});

UserRouter.get('/:userId',
	param('userId').exists().isString().matches(objectIdRegex),
	async (req: Request, res: Response) => {
		const userId = req.params.userId;
		await checkPermissions(req, `ciam.user.get.${userId}`);

		const op = await User.findOne({ _id: userId });
		if (!op) return res.status(404).send('User not found');
		res.send(op);
	});

UserRouter.delete('/:userId',
	param('userId').exists().isString().matches(objectIdRegex),
	async (req: Request, res: Response) => {
		const userId = req.params.userId;
		await checkPermissions(req, `ciam.user.delete.${userId}`);

		//@ts-ignore
		if (userId == `${req.user._id}`) return res.sendStatus(400);

		const op = await User.findByIdAndDelete(userId);
		if (!op) return res.status(404).send('User not found');
		res.send(op);
	});

export { UserRouter };

