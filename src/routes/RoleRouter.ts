import express, { Request, Response, NextFunction } from 'express';
import { body, query, param, Result } from 'express-validator';
import sanitize from 'mongo-sanitize';
import { Role } from '../schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import { checkPermissions, flagArray, PermissionError } from '../permission.js';
import { Check } from 'ciam-commons';
import { difference, flagValidator, validate } from '../utils.js';

const RoleRouter = express.Router();

RoleRouter.post('/create',
    body('name').isString().notEmpty(),
    body('description').isString().notEmpty(),
    body('permissions').optional().isArray().custom(flagValidator),
    validate,
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
    validate,
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
    body('permissions').optional().isArray().custom(flagValidator),
    validate,
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
    param('roleId').exists().isString().matches(Check.objectIdRegex),
    validate,
    async (req: Request, res: Response) => {
        const roleId = req.params.roleId;
        await checkPermissions(req, `ciam.role.get.${roleId}`);
        const op = await Role.findOne({ _id: roleId });
        if (!op) return res.status(404).send('Role not found');
        res.send(op);
    });

RoleRouter.delete('/:roleId',
    param('roleId').exists().isString().matches(Check.objectIdRegex),
    validate,
    async (req: Request, res: Response) => {
        const roleId = req.params.roleId;
        await checkPermissions(req, `ciam.role.delete.${roleId}`);
        const op = await Role.findOneAndDelete({ _id: roleId });
        if (!op) return res.status(404).send('Role not found');
        res.send(op);
    });

export { RoleRouter };