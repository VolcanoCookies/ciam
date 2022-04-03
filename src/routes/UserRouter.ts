import express, { Request, Response, NextFunction } from 'express';
import { User } from '../schemas/UserSchema.js';
import { difference, flagValidator, validate } from '../utils.js';
import { checkPermissions } from '../permission.js';
import { body, param, query, validationResult } from 'express-validator';
import { Check } from 'ciam-commons';

const UserRouter = express.Router();

UserRouter.get('/valid', (req, res) => res.sendStatus(200));

UserRouter.post('/create',
    body('name').exists().isString(),
    body('roles').optional().isArray(),
    body('permissions').optional().isArray().custom(flagValidator),
    validate,
    async (req, res) => {
        const { name, roles, permissions, discord } = req.body;
        const id = discord?.id;

        if (permissions) {
            //@ts-ignore
            const required = permissions.map(f => `ciam.permission.grant.${f}`);
            await checkPermissions(req, ...required);
        }

        if (roles) {
            //@ts-ignore
            const caller: User = req.__cache.user;
            for (const r of roles)
                if (!caller.roles.includes(r))
                    return res.status(400).send('Missing role ' + r);
        }

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

UserRouter.post('/update',
    body('_id').exists().isString(),
    body('name').optional().notEmpty(),
    body('roles').optional().isArray(),
    body('permissions').optional().isArray().custom(flagValidator),
    validate,
    async (req, res) => {
        const { _id, name, roles, permissions } = req.body;
        await checkPermissions(req, `ciam.user.update.${_id}`);

        const user = await User.findById(_id);
        if (!user) return res.status(404).send('User not found');

        if (permissions) {
            // Check if the user is allowed to give the provided permissions
            const added = difference(permissions, user.permissions);
            const removed = difference(user.permissions, permissions);

            const required = new Array();
            added.forEach(p => required.push(`ciam.permission.grant.${p}`));
            removed.forEach(p => required.push(`ciam.permission.revoke.${p}`));

            await checkPermissions(req, ...required);
            user.permissions = permissions;
        }
        if (name)
            user.name = name;
        if (roles) {
            //@ts-ignore
            const caller: User = req.__cache.user;
            for (const r of roles)
                if (!caller.roles.includes(r))
                    return res.status(400).send('Missing role ' + r);
            user.roles = roles;
        }

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

UserRouter.get('/list',
    query('page').isInt({ min: 0 }).default(0),
    query('limit').isInt({ min: 1, max: 100 }).default(100),
    validate,
    async (req: Request, res: Response) => {
        await checkPermissions(req, 'ciam.user.list');

        //@ts-ignore
        const { page, limit } = req.query as { page: number, limit: number; };

        let query = User.find();
        if (limit) {
            query = query.limit(limit);
            if (page > 0)
                query = query.skip(page * limit);
        }

        const op = await query.exec();
        if (!op) return res.sendStatus(500);
        res.send(op);
    });

UserRouter.get('/:userId',
    param('userId').exists().isString().matches(Check.objectIdRegex, 'g'),
    validate,
    async (req: Request, res: Response) => {
        const userId = req.params.userId;
        await checkPermissions(req, `ciam.user.get.${userId}`);

        const op = await User.findOne({ _id: userId });
        if (!op) return res.status(404).send('User not found');
        res.send(op);
    });

UserRouter.delete('/:userId',
    param('userId').exists().isString().matches(Check.objectIdRegex),
    validate,
    async (req: Request, res: Response) => {
        const userId = req.params.userId;
        await checkPermissions(req, `ciam.user.delete.${userId}`);

        //@ts-ignore
        if (userId == `${req.__cache.user._id}`) return res.sendStatus(400);

        const op = await User.findByIdAndDelete(userId);
        if (!op) return res.status(404).send('User not found');
        res.send(op);
    });

export { UserRouter };