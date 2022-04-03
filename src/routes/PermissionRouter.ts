import express, { Request, response, Response } from 'express';
import { body, param, query } from 'express-validator';
import sanitize from 'mongo-sanitize';
import { Permission } from '../schemas/PermissionSchema.js';
import { Document, Types } from 'mongoose';
import { flagValidator, stringToObjectIdArray, unique, validate } from '../utils.js';
import { User, UserEntry } from '../schemas/UserSchema.js';
import { hasAll, flagArray, flattenUser, flattenRole, checkPermissions } from '../permission.js';
import { Role, RoleEntry } from '../schemas/RoleSchema.js';
import { Check, Model } from 'ciam-commons';

const PermissionRouter = express.Router();

PermissionRouter.post('/create',
    body('name').exists().isString(),
    body('description').exists().isString(),
    body('flag').exists().isString().matches(Check.strictFlagRegex),
    validate,
    async (req: Request, res: Response) => {
        //@ts-ignore
        const { name, description, flag } = req.body;
        const lastIndex = flag.lastIndexOf('.');
        const key = flag.slice(lastIndex + 1);
        const path = flag.slice(0, Math.max(lastIndex, 0));

        await checkPermissions(req, `ciam.permission.create.${flag}`);

        if (await Permission.findOne({ flag: flag })) return res.status(400).send('Permission already exists');

        const permission = new Permission({
            name: name,
            description: description,
            key: key,
            path: path,
            flag: flag
        });

        const op = await permission.save();
        if (!op) return res.sendStatus(500);
        res.send(op);
    });

function toRegex(permission: string): RegExp {
    const regex = permission.replaceAll('?', '[a-z0-9]+')
        .replaceAll('.', '\.')
        .replace('*', '.*');
    return new RegExp(`^${regex}$`);
}

interface ListQuery {
    page: number;
    limit: number;
    search: string;
}

PermissionRouter.get('/me',
    validate,
    async (req: Request, res: Response) => {
        await checkPermissions(req, 'ciam.permission.me');

        //@ts-ignore
        const user: UserEntry = await User.findById(req.user.id);
        res.send(user.permissions);
    }
);

// Search defined the prefix of the permissions we are looking for, for example '*' finds all, and 'ciam.*' finds all that start with 'ciam'
PermissionRouter.get('/list',
    query('skip').isInt({ min: 0 }).default(0),
    query('limit').isInt({ min: 1, max: 100 }).default(100),
    query('search').isString().notEmpty().matches(Check.flagRegex).default('*'),
    validate,
    async (req: Request, res: Response) => {
        //@ts-ignore
        const { skip, limit, search } = req.query as { skip: number, limit: number, search: string; };

        await checkPermissions(req, `ciam.permission.list.${search}`);

        let query = Permission.find({ flag: toRegex(search) })
            .limit(limit)
            .skip(skip);

        const op = await query;
        if (!op) return res.sendStatus(500);

        // Remove any flags the user is not allowed to see
        const check = hasAll;

        res.send(op);
    });

PermissionRouter.post('/update',
    body('flag').exists().isString().matches(Check.strictFlagRegex),
    body('name').optional().isString().isLength({ min: 1 }),
    body('description').optional().isString().isLength({ min: 1 }),
    validate,
    async (req: Request, res: Response) => {
        const flag = req.body.flag;

        await checkPermissions(req, `ciam.permission.update.${flag}`);

        const permission = await Permission.findOne({ flag: flag });
        if (!permission) return res.status(404).send('Permission not found');

        const { name, description } = req.body;

        if (name)
            permission.name = name;
        if (description)
            permission.description = description;

        const op = await permission.save();
        if (!op) return res.sendStatus(500);
        res.send(op);
    });


PermissionRouter.post('/upsert',
    body('flag').exists().isString().matches(Check.strictFlagRegex),
    body('name').optional().isString().isLength({ min: 1 }),
    body('description').optional().isString().isLength({ min: 1 }),
    validate,
    async (req, res) => {
        //@ts-ignore
        const { name, description, flag } = req.body;
        await checkPermissions(req, `ciam.permission.upsert.${flag}`);

        const lastIndex = flag.lastIndexOf('.');
        const key = flag.slice(lastIndex + 1);
        const path = flag.slice(0, Math.max(lastIndex, 0));

        const op = await Permission.findOneAndUpdate({ flag: flag }, {
            $set: {
                name: name,
                description: description,
                key: key,
                path: path
            }
        }, { upsert: true, returnDocument: 'after' });

        console.log(op);

        if (!op) return res.sendStatus(500);
        res.send(op);
    }
);

PermissionRouter.post('/has',
    body('type').isIn(['user', 'role', 'discordUser']),
    body('id').exists().matches(/[0-9a-f]{12,24}/),
    body('required').exists().isArray({ min: 1 }).custom(flagValidator),
    body('additional').optional().isArray().default([]),
    body('includeMissing').optional().isBoolean().default(false),
    validate,
    async (req: Request, res: Response) => {
        const request = req.body as Model.CheckRequest;

        let subject: UserEntry | RoleEntry | null = null;

        switch (request.type) {
            case 'user': {
                subject = await User.findOne({ _id: request.id });
                break;
            }
            case 'role': {
                subject = await Role.findOne({ _id: request.id });
                break;
            }
            case 'discordUser': {
                subject = await User.findOne({ 'discord.id': request.id });
                break;
            }
        }

        if (!subject) return res.status(404).send(`${request.type} not found`);

        const flags = (subject instanceof User) ? await flattenUser(subject as UserEntry) : flattenRole(subject as RoleEntry);

        const required = flagArray(request.required, false, true);
        const checkCanCheck = required.map(r => `ciam.permissions.has.${r}`);
        await checkPermissions(req, ...checkCanCheck);

        const additional = flagArray(request.additional || [], false, true);
        const result = hasAll(required, flags.concat(additional), request.includeMissing);

        return res.status(200).send(result);
    });

PermissionRouter.get('/:flag',
    param('flag').exists().matches(Check.strictFlagRegex),
    validate,
    async (req: Request, res: Response) => {
        const flag = req.params.flag;
        await checkPermissions(req, `ciam.permission.get.${flag}`);
        const op = await Permission.findOne({ flag: flag });
        if (!op) return res.status(404).send('Permission not found');
        res.send(op);
    });

PermissionRouter.delete('/:flag',
    param('flag').exists().matches(Check.strictFlagRegex),
    validate,
    async (req: Request, res: Response) => {
        const flag = req.params.flag;
        await checkPermissions(req, `ciam.permission.get.${flag}`);
        const op = await Permission.findOneAndDelete({ flag: flag });
        if (!op) return res.status(404).send('Permission not found');
        res.send(op);
    });

export { PermissionRouter };