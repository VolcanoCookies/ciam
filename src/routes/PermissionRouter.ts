import express from 'express';
import { body, query } from 'express-validator';
import sanitize from 'mongo-sanitize';
import { Permission } from '../schemas/PermissionSchema.js';
import { Document, Types } from 'mongoose';
import { stringToObjectIdArray, unique } from '../utils.js';
import { User, UserEntry } from '../schemas/UserSchema.js';
import { has, hasAll, flagArray, flattenUser, flattenRole } from '../permission.js';
import { Role, RoleEntry } from '../schemas/RoleSchema.js';

const PermissionRouter = express.Router();

const getPermission = async (req: express.Request, res: express.Response, next: express.NextFunction) => {

    const permissionId = sanitize(req.params.roleId);

    if (!permissionId) return res.status(400).send(`Permission ${permissionId} not found.`);

    const permission = await Permission.findById(permissionId);

    if (!permission) return res.status(400).send(`Permission ${permissionId} not found.`);

    req.body.permission = permission;

    next();

};

const getPermissionBody = async (req: express.Request, res: express.Response, next: express.NextFunction) => {

    const permissionId = sanitize(req.body._id);

    if (!permissionId) return res.status(400).send(`Permission ${permissionId} not found.`);

    const permission = await Permission.findById(permissionId);

    if (!permission) return res.status(400).send(`Permission ${permissionId} not found.`);

    req.body.permission = permission;

    next();

};

PermissionRouter.use(express.json());
PermissionRouter.use((req, res, next) => {
    req.body = sanitize(req.body);
    next();
});

PermissionRouter.get('/:permissionId', getPermission, async (req, res) => {
    res.send(req.body.permission);
});

PermissionRouter.delete('/:permissionId', getPermission, async (req, res) => {

    const op = await req.body.permission.delete();

    if (!op) return res.status(500).send(`Permission ${req.body.permission._id} could not be deleted.`);

    res.send(op);

});

interface NewPermission {
    name: string;
    description: string;
    flag: string;
}

PermissionRouter.post('/create',
    body('name').exists().isString().isLength({ min: 1 }),
    body('description').exists().isString().isLength({ min: 1 }),
    body('flag').exists().isString().matches(/[a-z]+´(\.[a-z])*/),
    async (req, res) => {

        const { name, description, flag } = req.body as NewPermission;
        const lastIndex = flag.lastIndexOf('.');
        const key = flag.slice(lastIndex);
        const path = flag.slice(0, Math.max(lastIndex, 0));

        const permission = new Permission({
            name: name,
            description: description,
            key: key,
            path: path,
            fullPath: flag
        });

        const op = await permission.save();
        if (!op) return res.sendStatus(500);
        res.send(op);

    });

PermissionRouter.get('/list',
    query('page').optional().isInt({ min: 0 }).default(0),
    query('limit').optional().isInt({ min: 1, max: 100 }).default(100),
    async (req, res) => {

        const { page, limit } = req.query as { page: number, limit: number; };

        let query = Permission.find();
        if (limit) {
            query = query.limit(limit);
            if (page > 0)
                query = query.skip(page * limit);
        }

        const op = await query;
        if (!op) return res.sendStatus(500);
        res.send(op);

    });

PermissionRouter.post('/update', getPermissionBody, async (req, res) => {

    const permission: Document<Permission> & Permission = req.body.permission;

    const { name, description } = req.body;

    if (name) {
        if (name.length == 0) return res.status(400).send('empty name');
        permission.name = name;
    }

    if (description) {
        if (description.length == 0) return res.status(400).send('empty description');
        permission.description = description;
    }

    const op = await permission.save();

    if (!op) return res.sendStatus(500);

    res.send(op);

});

interface CheckRequest {
    type: 'user' | 'role';
    id: string;
    required: Array<string>;
    additional: Array<string>;
    includeMissing: boolean;
}

PermissionRouter.post('/has',
    body('type').isIn(['user', 'role']),
    body('id').exists().matches(/[0-9a-f]{12,24}/),
    body('required').exists().isArray({ min: 1 }),
    body('additional').optional().isArray().default([]),
    body('includeMissing').optional().isBoolean().default(false),
    async (req, res) => {

        const request = req.body as CheckRequest;
        const subject = request.type == 'user' ? await User.findById(request.id) : await Role.findById(request.id);

        if (!subject) return res.status(404).send(`${request.type} not found`);

        const flags = (subject instanceof User) ? await flattenUser(subject as UserEntry) : flattenRole(subject as RoleEntry);

        try {
            const required = flagArray(request.required, false, true);
            const additional = flagArray(request.additional, false, true);
            const result = hasAll(required, flags.concat(additional), request.includeMissing);

            return res.status(200).send(result);
        } catch (e) {
            return res.send(400).send('invalid permission flags');
        }

    });

export { PermissionRouter };