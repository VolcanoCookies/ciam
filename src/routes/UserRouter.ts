import express, { Request, Response, NextFunction } from 'express';
import sanitize from 'mongo-sanitize';
import { User } from '../schemas/UserSchema.js';
import { createToken } from '../utils.js';
import { checkPermissions } from '../permission.js';



const UserRouter = express.Router();

const getUser = async (req: Request, res: Response, next: NextFunction) => {
    const userId = sanitize(req.params.userId);

    if (!userId) return res.status(400).send(`User ${userId} not found.`);

    const user = await User.findById(userId);

    if (!user) return res.status(400).send(`User ${userId} not found.`);

    req.body.user = user;

    next();
};

UserRouter.post('/create', async (req, res) => {

    const { name, roles, permissions, discord } = req.body;
    const { id } = discord;

    if (!name || !discord) return res.sendStatus(400);

    const user = new User({
        name: name,
        discord: {
            id: id
        },
        roles: roles,
        permissions: permissions
    });

    const op = await user.save();

    if (!op) return res.sendStatus(500);

    res.send(op);

});

UserRouter.get('/token/:userId', getUser, async (req, res) => {
    const user = req.body.user as User;
    if (!checkPermissions(req, `ciam.user.token.${user._id}`)) return res.sendStatus(401);
    return res.send(createToken(user));
});

export { UserRouter };