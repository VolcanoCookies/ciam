import express from 'express';
import { checkSchema } from 'express-validator';
import sanitize from 'mongo-sanitize';
import { Permission } from '../schemas/PermissionSchema.js';
import { Document, Types } from 'mongoose';
import { stringToObjectIdArray, unique } from '../utils.js';

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

PermissionRouter.post('/create', async (req, res) => {

    const { name, description, key, path } = req.body;

    if (!name || name.length == 0) return res.status(400).send('missing name');

    if (!description) return res.status(400).send('missing description');

    if (!key || key.length == 0) return res.status(400).send('missing key');

    if (!path || path.length == 0) return res.status(400).send('missing path');

    const permission = new Permission({
        name: name,
        description: description,
        key: key,
        path: path,
        fullPath: `${path}.${key}`
    });

    const op = await permission.save();

    if (!op) return res.sendStatus(500);

    res.send(op);

});

PermissionRouter.get('/list', async (req, res) => {

    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || undefined;

    if (isNaN(page)) return res.status(400).send('page NaN');
    else if (limit && isNaN(limit)) res.status(400).send('limit NaN');
    else if (page < 0) return res.status(400).send('page negative');
    else if (limit && limit < 1) return res.status(400).send('limit < 1');

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

export { PermissionRouter };