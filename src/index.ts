import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
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

app.use(jwt({
    secret: process.env.CLIENT_SECRET as string,
    algorithms: ['HS256']
}).unless({ path: ['/login', '/callback'] }));

app.use((req, res, next) => {
    req.body = sanitize(req.body);
    next();
});

app.use(express.json());

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).send('invalid token');
    } else if (err) {
        console.log(err);
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

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.log(err.name);
    if (err.name === 'PermissionError')
        res.status(401).send(err.message);
    else if (err) {
        console.error(err);
        res.sendStatus(400);
    }
});

app.listen(process.env.PORT, async () => {
    await init();
    console.log(`Started CIAM on port ${process.env.PORT}`);
});

export { app };