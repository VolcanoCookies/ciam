import express, { Request, Response, NextFunction } from 'express';
import { body, query, param, Result } from 'express-validator';
import sanitize from 'mongo-sanitize';
import { Role } from '../schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import { checkPermissions, Flag, flagArray, PermissionError } from '../permission.js';
import { Check } from 'ciam-commons';

const RoleRouter = express.Router();

RoleRouter.post('/create',
    body('name').isString().notEmpty(),
    body('description').isString().notEmpty(),
    body('permissions').optional().isArray(),
    async (req: Request, res: Response) => {
        await checkPermissions(req, `ciam.role.create`);

        const { name, description, permissions } = req.body;

        const role = new Role({
            name: name,
            description: description,
            permissions: permissions || [],
            //@ts-ignore
            creator: req.__cache.user._id
        });

        const op = await role.save();
        if (!op) return res.sendStatus(500);
        res.send(op);
    });

RoleRouter.get('/list',
    query('page').isInt({ min: 0 }).default(0),
    query('limit').isInt({ min: 1, max: 100 }).default(100),
    async (req: Request, res: Response) => {
        await checkPermissions(req, 'ciam.role.list');

        //@ts-ignore
        const { page, limit } = req.query as { page: number, limit: number; };

        let query = Role.find();
        if (limit) {
            query = query.limit(limit);
            if (page > 0)
                query = query.skip(page * limit);
        }

        const op = await query.exec();
        if (!op) return res.sendStatus(500);
        res.send(op);
    });

RoleRouter.post('/update',
    body('_id').exists().isString().matches(Check.objectIdRegex),
    body('name').optional().isString().notEmpty(),
    body('description').optional().isString().notEmpty(),
    body('permissions').optional().isArray().custom(v => {
        return flagArray(v, false, true);
    }),
    async (req, res) => {
        const roleId = req.body._id;
        const required = [`ciam.role.update.${roleId}`];

        const role = await Role.findOne({ _id: roleId });
        if (!role) return res.status(404).send('Role not found');

        const { name, description, inherit, permissions } = req.body;

        if (permissions)
            for (const p of permissions)
                required.push(p);

        await checkPermissions(req, ...required);

        if (permissions)
            role.set('permissions', flagArray(permissions));
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
    param('roleId').exists().isString().matches(Check.objectIdRegex),
    async (req: Request, res: Response) => {
        const roleId = req.params.roleId;
        await checkPermissions(req, `ciam.role.get.${roleId}`);
        const op = await Role.findOne({ _id: roleId });
        if (!op) return res.status(404).send('Role not found');
        res.send(op);
    });

RoleRouter.delete('/:roleId',
    param('roleId').exists().isString().matches(Check.objectIdRegex),
    async (req: Request, res: Response) => {
        const roleId = req.params.roleId;
        await checkPermissions(req, `ciam.role.delete.${roleId}`);
        const op = await Role.findOneAndDelete({ _id: roleId });
        if (!op) return res.status(404).send('Role not found');
        res.send(op);
    });

export { RoleRouter };