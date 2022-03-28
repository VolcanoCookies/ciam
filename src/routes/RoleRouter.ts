import express from 'express';
import { checkSchema, query } from 'express-validator';
import sanitize from 'mongo-sanitize';
import { Role } from '../schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import { stringToObjectIdArray, unique } from '../utils.js';
import { Flag, flagArray } from '../permission.js';

const RoleRouter = express.Router();

const getRole = async (req: express.Request, res: express.Response, next: express.NextFunction) => {

    const roleId = sanitize(req.params.roleId);

    if (!roleId) return res.status(400).send(`Role ${roleId} not found.`);

    const role = await Role.findById(roleId);

    if (!role) return res.status(400).send(`Role ${roleId} not found.`);

    req.body.role = role;

    next();

};

const getRoleBody = async (req: express.Request, res: express.Response, next: express.NextFunction) => {

    const roleId = sanitize(req.body._id);

    if (!roleId) return res.status(400).send(`Role ${roleId} not found.`);

    const role = await Role.findById(roleId);

    if (!role) return res.status(400).send(`Role ${roleId} not found.`);

    req.body.role = role;

    next();

};

RoleRouter.use(express.json());
RoleRouter.use((req, res, next) => {
    req.body = sanitize(req.body);
    next();
});

RoleRouter.post('/create', async (req, res) => {

    const { name, description } = req.body;

    if (!name || name.length == 0) return res.status(400).send('Missing name.');

    if (!description) return res.status(400).send('Missing description.');

    const role = new Role({
        name: name,
        description: description
    });

    const op = await role.save();

    if (!op) return res.sendStatus(500);

    res.send(op);

});

RoleRouter.get('/list',
    query('page').isInt({ min: 0 }).default(0),
    query('limit').isInt({ min: 1, max: 100 }).default(100),
    async (req, res) => {

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

RoleRouter.post('/update', getRoleBody, async (req, res) => {

    const role: Document<Role> & Role = req.body.role;

    const { name, description, inherit, permissions } = req.body;

    if (name) {
        if (name.length == 0) return res.status(400).send('empty name');
        role.name = name;
    }

    if (description) {
        if (description.length == 0) return res.status(400).send('empty description');
        role.description = description;
    }

    if (inherit) {
        if (!Array.isArray(inherit)) return res.status(400).send('inherit not array');
        //role.inherit = stringToObjectIdArray(unique(inherit));
    }

    if (permissions) {
        if (!Array.isArray(permissions)) return res.status(400).send('permissions not array');

        try {
            role.set('permissions', flagArray(permissions));
        } catch (e) {
            return res.status(400).send('permissions invalid');
        }
    }

    const op = await role.save();

    if (!op) return res.sendStatus(500);

    res.send(op);

});

RoleRouter.get('/:roleId', getRole, async (req, res) => {
    res.send(req.body.role);
});

RoleRouter.delete('/:roleId', getRole, async (req, res) => {

    const op = await req.body.role.delete();

    if (!op) return res.status(404).send(`Role ${req.body.role._id} could not be deleted.`);

    res.send(op);

});

export { RoleRouter };