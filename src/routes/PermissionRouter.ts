import {
	CheckRequest,
	Flag,
	flagRegex,
	isPermissionHolder,
	PermissionHolder,
	PermissionHolderType,
	StrictFlag,
	strictFlagRegex,
	unique,
} from 'ciam-commons';
import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { discordClient } from '../discord.js';
import { assertPermissions, checkPermissions } from '../permission.js';
import { discordRoleModel } from '../schemas/DiscordRoleSchema.js';
import { permissionModel } from '../schemas/PermissionSchema.js';
import { roleModel } from '../schemas/RoleSchema.js';
import { userModel, UserType } from '../schemas/UserSchema.js';
import {
	bodyHasAny,
	TypedQueryRequest,
	TypedRequest,
	validate,
	validatePermissionHolder,
} from '../utils.js';

const permissionRouter = express.Router();

interface PermissionPost {
	name: string;
	description: string;
	flag: StrictFlag;
}

permissionRouter.post(
	'/',
	body('name').isString(),
	body('description').isString(),
	body('flag').matches(strictFlagRegex),
	validate,
	async (req: TypedRequest<PermissionPost>, res: Response) => {
		const { name, description, flag } = req.body;
		const lastIndex = flag.lastIndexOf('.');
		const key = flag.slice(lastIndex + 1);
		const path = flag.slice(0, Math.max(lastIndex, 0));

		await assertPermissions(
			req,
			`ciam.permission.create.${flag.toString()}`
		);

		if (await permissionModel.findOne({ flag }))
			return res.status(400).send('Permission already exists');

		const permission = new permissionModel({
			name,
			description,
			key,
			path,
			flag,
			creator: req.user._id,
		});

		const op = await permission.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	}
);

interface PermissionPatch {
	flag: StrictFlag;
	name: string;
	description: string;
}

permissionRouter.patch(
	'/',
	body('flag').exists().isString().matches(strictFlagRegex),
	body('name').optional().isString().isLength({ min: 1 }),
	body('description').optional().isString().isLength({ min: 1 }),
	bodyHasAny('name', 'description'),
	validate,
	async (req: TypedRequest<PermissionPatch>, res: Response) => {
		const flag = req.body.flag;

		await assertPermissions(
			req,
			`ciam.permission.update.${flag.toString()}`
		);

		const permission = await permissionModel.findOne({ flag });
		if (!permission) return res.status(404).send('Permission not found');

		const { name, description } = req.body;

		if (name) permission.name = name;
		if (description) permission.description = description;

		const op = await permission.save();
		if (!op) return res.sendStatus(500);
		res.send(op);
	}
);

const toRegex = (permission: string): RegExp => {
	const regex = permission
		.replaceAll('?', '[a-z0-9]+')
		.replaceAll('.', '\\.')
		.replace('*', '.*');
	return new RegExp(`^${regex}$`);
};

// eslint-disable-next-line @typescript-eslint/no-misused-promises
permissionRouter.get('/me', async (req: Request, res: Response) => {
	await assertPermissions(req, 'ciam.permission.me');

	const user = await userModel.findById(req.user._id);
	if (user === null) return res.status(401);
	res.send(user.permissions);
});

interface PermissionListGet {
	skip: number;
	limit: number;
	search: string;
}

// Search defined the prefix of the permissions we are looking for, for example '*' finds all, and 'ciam.*' finds all that start with 'ciam'
permissionRouter.get(
	'/list',
	query('skip').isInt({ min: 0 }).default(0),
	query('limit').isInt({ min: 1, max: 100 }).default(100),
	query('search').isString().notEmpty().matches(flagRegex).default('*'),
	validate,
	async (req: TypedQueryRequest<PermissionListGet>, res: Response) => {
		const { skip, limit, search } = req.query;

		await assertPermissions(req, `ciam.permission.list.${search}`);

		const query = permissionModel
			.find({ flag: toRegex(search) })
			.limit(limit)
			.skip(skip);

		const op = await query;
		if (!op) return res.sendStatus(500);

		res.send(op);
	}
);

permissionRouter.post(
	'/upsert',
	body('flag').matches(strictFlagRegex),
	body('name').isString(),
	body('description').isString(),
	validate,
	async (req: TypedRequest<PermissionPost>, res: Response) => {
		const { name, description, flag } = req.body;
		await assertPermissions(
			req,
			`ciam.permission.upsert.${flag.toString()}`
		);

		const lastIndex = flag.lastIndexOf('.');
		const key = flag.slice(lastIndex + 1);
		const path = flag.slice(0, Math.max(lastIndex, 0));

		const op = await permissionModel.findOneAndUpdate(
			{ flag },
			{
				$set: {
					name,
					description,
					key,
					path,
				},
			},
			{ upsert: true, returnDocument: 'after' }
		);

		if (!op) return res.sendStatus(500);
		res.send(op);
	}
);

// TODO: Don't ignore additional
// TODO: Add option to check permissions without triggering cooldown
permissionRouter.post(
	'/check',
	body('holder').custom(validatePermissionHolder),
	body('required.*')
		.matches(flagRegex)
		.customSanitizer((value: string) => Flag.validate(value)),
	body('additional').default([]),
	body('additional.*')
		.matches(flagRegex)
		.customSanitizer((value: string) => Flag.validate(value)),
	validate,
	async (req: TypedRequest<CheckRequest>, res: Response) => {
		const { holder, required, additional } = req.body;

		const checkCanCheck = required.map(
			(r) => `ciam.permissions.check.${r.toString()}`
		);
		await assertPermissions(req, ...checkCanCheck);

		const results = await checkPermissions(holder, required);
		const allPassed = results.every((r) => r.passed);
		const onCooldown = results.some((r) => r.onCooldown);

		return res.status(200).send({
			allPassed,
			onCooldown,
			checks: results,
		});
	}
);

// TODO: Add separate optional endpoint to trigger permission cooldowns

permissionRouter.get(
	'/:flag',
	param('flag').matches(strictFlagRegex),
	validate,
	async (req: Request, res: Response) => {
		const flag = req.params.flag;
		await assertPermissions(req, `ciam.permission.get.${flag}`);
		const op = await permissionModel.findOne({ flag });
		if (!op) return res.status(404).send('Permission not found');
		res.send(op);
	}
);

permissionRouter.delete(
	'/:flag',
	param('flag').matches(strictFlagRegex),
	validate,
	async (req: Request, res: Response) => {
		const flag = req.params.flag;
		await assertPermissions(req, `ciam.permission.get.${flag}`);
		const op = await permissionModel.findOneAndDelete({ flag });
		if (!op) return res.status(404).send('Permission not found');
		res.send(op);
	}
);

interface PermissionHolderPatch {
	holder: PermissionHolder;
	addPermissions: Flag[];
	removePermissions: Flag[];
}

permissionRouter.patch(
	'/holder',
	body('holder').custom((v) => isPermissionHolder(v)),
	body('addPermissions').optional().isArray(),
	body('removePermissions').optional().isArray(),
	body('addPermissions.*')
		.matches(flagRegex)
		.customSanitizer((v: string) => Flag.validate(v)),
	body('removePermissions.*')
		.matches(flagRegex)
		.customSanitizer((v: string) => Flag.validate(v)),
	bodyHasAny('addPermissions', 'removePermissions'),
	validate,
	async (req: TypedRequest<PermissionHolderPatch>, res: Response) => {
		const { holder, addPermissions, removePermissions } = req.body;

		const requiredAdd = addPermissions.map(
			(f) => `ciam.permissions.holder.add.${f.toString()}`
		);
		const requiredRemove = removePermissions.map(
			(f) => `ciam.permissions.holder.remove.${f.toString()}`
		);

		const required = requiredAdd.concat(requiredRemove);
		await assertPermissions(req, ...unique(required));

		const update = {
			$addToSet: {
				permissions: addPermissions,
			},
			$pullAll: {
				permissions: removePermissions,
			},
		};
		const projection = {
			projection: {
				permissions: 1,
			},
		};

		switch (holder.type) {
			case PermissionHolderType.USER: {
				const updatedUser = await userModel.updateOne(
					{ _id: holder.id },
					update,
					projection
				);

				if (updatedUser === null)
					return res.status(404).send('User not found');
				else return res.send(updatedUser);
			}
			case PermissionHolderType.DISCORD_USER: {
				const discordUser = await discordClient.users.fetch(holder.id);
				if (discordUser === undefined)
					return res.status(404).send('Discord user not found');

				const updatedUser = await userModel.updateOne(
					{
						'discord.id': holder.id,
					},
					{
						...update,
						$setOnInsert: {
							'discord.id': holder.id,
							name: discordUser.username,
							type: UserType.USER,
							avatar: discordUser.avatarURL(),
						},
					},
					projection
				);

				if (updatedUser === null)
					return res.status(404).send('Discord user not found');
				else return res.send(updatedUser);
			}
			case PermissionHolderType.ROLE: {
				const updatedRole = await roleModel.updateOne(
					{
						_id: holder.id,
					},
					update,
					projection
				);

				if (updatedRole === null)
					return res.status(404).send('Role not found');
				else return res.send(updatedRole);
			}
			case PermissionHolderType.DISCORD_ROLE: {
				const role = discordClient.guilds.cache
					.find((g) => g.roles.cache.has(holder.id))
					?.roles?.cache?.get(holder.id);
				if (role === undefined)
					return res.status(404).send('Discord role not foudn');

				const updatedRole = await discordRoleModel.updateOne(
					{
						_id: holder.id,
					},
					{
						...update,
						$setOnInsert: {
							_id: holder.id,
							name: role?.name,
							guildId: role?.guild.id,
						},
					},
					projection
				);

				if (updatedRole === null)
					return res.status(404).send('Discord role not found');
				else return res.send(updatedRole);
			}
		}
	}
);

export { permissionRouter };
