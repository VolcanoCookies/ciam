import { difference, flagArray, objectIdRegex } from 'ciam-commons';
import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { checkPermissions } from '../permission.js';
import { Role } from '../schemas/RoleSchema.js';
import { flagValidator } from '../utils.js';

const RoleRouter = express.Router();

RoleRouter.post('/create',
	body('name').isString().notEmpty(),
	body('description').isString().notEmpty(),
	body('permissions').optional().isArray().custom(flagValidator),
	async (req: Request, res: Response) => {
		await checkPermissions(req, `ciam.role.create`);

		const { name, description, permissions } = req.body;

		const role = new Role({
			name: name,
			description: description,
			permissions: permissions || [],
			creator: req.user._id
		});

		const op = await role.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	});

RoleRouter.get('/list',
	query('skip').isInt({ min: 0 }).default(0),
	query('limit').isInt({ min: 1, max: 100 }).default(100),
	async (req: Request, res: Response) => {
		//@ts-ignore
		const { skip, limit } = req.query as { skip: number, limit: number; };

		await checkPermissions(req, `ciam.role.list`);

		let query = Role.find({})
			.limit(limit)
			.skip(skip);

		const op = await query;
		if (!op) return res.sendStatus(500);

		res.send(op);
	});

RoleRouter.post('/update',
	body('_id').exists().isString().matches(objectIdRegex),
	body('name').optional().isString().notEmpty(),
	body('description').optional().isString().notEmpty(),
	body('permissions').optional().isArray().custom(flagValidator),
	async (req, res) => {
		const roleId = req.body._id;
		await checkPermissions(req, `ciam.role.update.${roleId}`);

		const role = await Role.findOne({ _id: roleId });
		if (!role) return res.status(404).send('Role not found');

		const { name, description, inherit, permissions } = req.body;

		if (permissions) {
			// Check if the user updating this role is allowed to give it the provided permissions
			const added = difference(permissions, role.permissions);
			const removed = difference(role.permissions, permissions);

			const required = new Array();
			added.forEach(p => required.push(`ciam.permission.grant.${p}`));
			removed.forEach(p => required.push(`ciam.permission.revoke.${p}`));

			await checkPermissions(req, ...required);
			role.set('permissions', flagArray(permissions));
		}
		if (name)
			role.name = name;
		if (description)
			role.description = description;
		//if (inherit)
		//role.inherit = stringToObjectIdArray(unique(inherit));

		const op = await role.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	});

RoleRouter.get('/:roleId',
	param('roleId').exists().isString().matches(objectIdRegex),
	async (req: Request, res: Response) => {
		const roleId = req.params.roleId;
		await checkPermissions(req, `ciam.role.get.${roleId}`);
		const op = await Role.findOne({ _id: roleId });
		if (!op) return res.status(404).send('Role not found');
		res.send(op);
	});

RoleRouter.delete('/:roleId',
	param('roleId').exists().isString().matches(objectIdRegex),
	async (req: Request, res: Response) => {
		const roleId = req.params.roleId;
		await checkPermissions(req, `ciam.role.delete.${roleId}`);
		const op = await Role.findOneAndDelete({ _id: roleId });
		if (!op) return res.status(404).send('Role not found');
		res.send(op);
	});

export { RoleRouter };

