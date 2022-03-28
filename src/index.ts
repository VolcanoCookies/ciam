import 'dotenv/config';
import express from 'express';
import sanitize from 'mongo-sanitize';
import mongoose from 'mongoose';
import { PermissionRouter } from './routes/PermissionRouter.js';
import { RoleRouter } from './routes/RoleRouter.js';
import { AuthRouter } from './routes/AuthRouter.js';
import jwt from 'express-jwt';
import { UserRouter } from './routes/UserRouter.js';

const app = express();

const init = async () => {
    await mongoose.connect(process.env.DATABASE_URL!);
};

const clientSecret = process.env.CLIENT_SECRET as string;

app.use(jwt({
    secret: clientSecret,
    algorithms: ['HS256']
}).unless({ path: ['/login', '/callback'] }));

app.use((req, res, next) => {
    req.body = sanitize(req.body);
    next();
});

app.use(express.json());

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).send('invalid token');
    } else if (err) {
        return res.status(400);
    }
    next();
});

app.use(AuthRouter);

app.use(async (req, res, next) => {
    //@ts-ignore
    console.log(`${req.ip} | ${req.user.id} | ${req.url}`);
    next();
});

app.use('/role', RoleRouter);
app.use('/permission', PermissionRouter);
app.use('/user', UserRouter);

app.listen(process.env.PORT, async () => {
    await init();
    console.log(`Started CIAM on port ${process.env.PORT}`);
});