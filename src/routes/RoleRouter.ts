import express from 'express';
import { checkSchema } from 'express-validator';
import sanitize from 'mongo-sanitize';
import { Role } from '../schemas/RoleSchema.js';
import { Document, Types } from 'mongoose';
import { stringToObjectIdArray, unique } from '../utils.js';
import { validate, ValidatedPermissions } from '../permission.js';

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

RoleRouter.get('/:roleId', getRole, async (req, res) => {

    res.send(req.body.role);

});

RoleRouter.delete('/:roleId', getRole, async (req, res) => {

    const op = await req.body.role.delete();

    if (!op) return res.status(404).send(`Role ${req.body.role._id} could not be deleted.`);

    res.send(op);

});

RoleRouter.post('/create', async (req, res) => {

    const { name, description } = req.body;

    if (!name || name.length == 0) return res.status(404).send('Missing name.');

    if (!description) return res.status(404).send('Missing description.');

    const role = new Role({
        name: name,
        description: description
    });

    const op = await role.save();

    if (!op) return res.sendStatus(500);

    res.send(op);

});

RoleRouter.get('/list', async (req, res) => {

    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || undefined;

    if (isNaN(page)) return res.status(400).send('page NaN');
    else if (limit && isNaN(limit)) res.status(400).send('limit NaN');
    else if (page < 0) return res.status(400).send('page negative');
    else if (limit && limit < 1) return res.status(400).send('limit < 1');

    let query = Role.find();
    if (limit) {
        query = query.limit(limit);
        if (page > 0)
            query = query.skip(page * limit);
    }

    const op = await query;

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
        if (!permissions.every(p => validate(p) != undefined)) return res.status(400).send('permissions invalid');
        role.permissions = permissions as Types.Array<string>;
    }

    const op = await role.save();

    if (!op) return res.sendStatus(500);

    res.send(op);

});

export { RoleRouter };