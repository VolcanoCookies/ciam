import express, { Request, Response, NextFunction } from 'express';
import sanitize from 'mongo-sanitize';
import { User, UserEntry } from '../schemas/UserSchema.js';
import { createToken, objectIdRegex } from '../utils.js';
import { checkPermissions } from '../permission.js';
import { body, param } from 'express-validator';

const UserRouter = express.Router();

UserRouter.get('/valid', (req, res) => res.sendStatus(200));

// TODO: Currently any role can be given, regardless of what permissions that role has
UserRouter.post('/create',
    body('name').exists().isString(),
    async (req, res) => {
        const { name, roles, permissions, discord } = req.body;
        const id = discord?.id;

        const user = new User({
            name: name,
            roles: roles,
            permissions: permissions
        });

        if (id)
            //@ts-ignore
            user.discord = { id: id };

        const op = await user.save();
        if (!op) return res.sendStatus(500);
        res.send(op);
    });

// TODO: Currently any role can be given, regardless of what permissions that role has
UserRouter.post('/update',
    body('_id').exists().isString(),
    body('name').optional().notEmpty(),
    body('roles').optional().isArray(),
    body('permissions').optional().isArray(),
    async (req, res) => {
        await checkPermissions(req, `ciam.role.update.${req.body._id}`);

        const { _id, name, roles, permissions } = req.body;
        const user = await User.findById(_id);

        if (!user) return res.status(404).send('User not found');

        if (permissions) {
            await checkPermissions(req, permissions);
            user.permissions = permissions;
        }
        if (name)
            user.name = name;
        if (roles)
            user.roles = roles;

        const op = await user.save();
        if (!op) res.sendStatus(500);
        res.send(op);
    }
);

// This is dumb, if they can access this endpoint then they already have a token
/*UserRouter.get('/token', async (req, res) => {
    await checkPermissions(req, `ciam.user.token.self`);
    //@ts-ignore
    return res.send(createToken(req.__cache.user));
});*/

UserRouter.get('/:userId',
    param('userId').exists().isString().matches(objectIdRegex),
    async (req: Request, res: Response) => {
        await checkPermissions(req, `ciam.user.get.${req.params.userId}`);

        const op = await User.findOne({ _id: req.params.userId });
        if (!op) return res.status(404).send('User not found');
        res.send(op);
    });

UserRouter.delete('/:userId',
    param('userId').exists().isString(),
    async (req: Request, res: Response) => {
        await checkPermissions(req, `ciam.user.delete.${req.params.userId}`);

        //@ts-ignore
        if (req.params.userId == `${req.__cache.user._id}`) return res.sendStatus(400);

        const op = await User.findByIdAndDelete(req.params.userId);
        if (!op) return res.status(404).send('User not found');
        res.send(op);
    });

export { UserRouter };