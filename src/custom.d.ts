import { Model } from 'ciam-commons';
import { User } from './schemas/UserSchema';

declare module 'express-serve-static-core' {
	interface Request {
		user: User;
		flags: Array<Model.Flag>;
	}
}