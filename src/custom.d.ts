import { Flag } from 'ciam-commons';
import { User } from './schemas/UserSchema';

declare module 'express-serve-static-core' {
	interface Request {
		user: User;
		flags: Array<Flag>;
	}
}