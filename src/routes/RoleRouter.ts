import {
	difference,
	Flag,
	flagArray,
	flagRegex,
	objectIdRegex,
} from 'ciam-commons';
import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { assertPermissions } from '../permission.js';
import { roleModel } from '../schemas/RoleSchema.js';
import {
	bodyHasAny,
	TypedQueryRequest,
	TypedRequest,
	validate,
} from '../utils.js';

const roleRouter = express.Router();

interface RolePost {
	name: string;
	description: string;
	permissions?: Flag[];
}

roleRouter.post(
	'/',
	body('name').isString(),
	body('description').isString(),
	body('permissions.*').matches(flagRegex),
	validate,
	async (req: TypedRequest<RolePost>, res: Response) => {
		await assertPermissions(req, `ciam.role.create`);

		const { name, description, permissions } = req.body;

		const role = new roleModel({
			name,
			description,
			permissions: permissions || [],
			creator: req.user._id,
		});

		const op = await role.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	}
);

interface RolePatch {
	_id: string;
	name?: string;
	description?: string;
	permissions?: Flag[];
}

// TODO: add inherit
roleRouter.patch(
	'/',
	body('_id').matches(objectIdRegex),
	body('name').optional().isString(),
	body('description').optional().isString(),
	body('permissions.*').matches(flagRegex),
	bodyHasAny('name', 'description', 'permissions.*'),
	validate,
	async (req: TypedRequest<RolePatch>, res: Response) => {
		const roleId = req.body._id;
		await assertPermissions(req, `ciam.role.update.${roleId}`);

		const role = await roleModel.findOne({ _id: roleId });
		if (role === null) return res.status(404).send('Role not found');

		const { name, description, permissions } = req.body;

		if (permissions) {
			// Check if the user updating this role is allowed to give it the provided permissions
			const added = difference(permissions, role.permissions);
			const removed = difference(role.permissions, permissions);

			const required = new Array<string>();
			added.forEach((p) =>
				required.push(`ciam.permission.grant.${p.toString()}`)
			);
			removed.forEach((p) =>
				required.push(`ciam.permission.revoke.${p.toString()}`)
			);

			await assertPermissions(req, ...required);
			role.set('permissions', flagArray(permissions));
		}
		if (name) role.name = name;
		if (description) role.description = description;
		//  if (inherit)
		//  role.inherit = stringToObjectIdArray(unique(inherit));

		const op = await role.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	}
);

interface RoleListGet {
	skip: number;
	limit: number;
}

roleRouter.get(
	'/:roleId',
	param('roleId').matches(objectIdRegex),
	validate,
	async (req: Request, res: Response) => {
		const roleId = req.params.roleId;
		await assertPermissions(req, `ciam.role.get.${roleId}`);

		const op = await roleModel.findOne({ _id: roleId });
		if (!op) return res.status(404).send('Role not found');
		res.send(op);
	}
);

roleRouter.delete(
	'/:roleId',
	param('roleId').matches(objectIdRegex),
	validate,
	async (req: Request, res: Response) => {
		const roleId = req.params.roleId;
		await assertPermissions(req, `ciam.role.delete.${roleId}`);

		const op = await roleModel.findOneAndDelete({ _id: roleId });
		if (!op) return res.status(404).send('Role not found');
		res.send(op);
	}
);

roleRouter.get(
	'/list',
	query('skip').default(0).isInt({ min: 0 }),
	query('limit').default(100).isInt({ min: 1, max: 100 }),
	validate,
	async (req: TypedQueryRequest<RoleListGet>, res: Response) => {
		const { skip, limit } = req.query;

		await assertPermissions(req, `ciam.role.list`);

		const op = await roleModel.find({}).limit(limit).skip(skip);
		if (!op) return res.sendStatus(500);

		res.send(op);
	}
);

export { roleRouter };
