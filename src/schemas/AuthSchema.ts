import mongoose, { Types } from 'mongoose';
import { REFS } from './refs.js';

const Schema = mongoose.Schema;

// Request: The user has been redirected to ciam and needs to press confirm
// Pending: The user has been redirected to discord and we're awaiting callback
type State = 'request' | 'pending';

interface AuthRequest {
	scope: Array<string>;
	redirect: string;
	domain: string;
	createdAt: Date;
	expiresAt: Date;
	state: State;
	stateId: string;
	client: Types.ObjectId;
}

const AuthRequestSchema = new Schema<AuthRequest>({
	scope: [{
		type: String,
		required: true
	}],
	redirect: {
		type: String,
		required: true
	},
	createdAt: {
		type: Date,
		default: Date.now,
		required: true
	},
	expiresAt: {
		type: Date,
		expires: 0,
		required: true
	},
	state: { type: String },
	stateId: {
		type: String,
		index: true,
		unique: true,
		required: true
	},
	client: {
		type: Schema.Types.ObjectId,
		ref: REFS.USER,
		required: true
	}
});

interface IdentifyRequest {
	redirect: string;
	createdAt: Date;
	expiresAt: Date;
	stateId: string;
}

const IdentifyRequestSchema = new Schema<IdentifyRequest>({
	redirect: {
		type: String,
		required: true
	},
	createdAt: {
		type: Date,
		default: Date.now,
		required: true
	},
	expiresAt: {
		type: Date,
		expires: 0,
		required: true
	},
	stateId: {
		type: String,
		required: true,
		index: true
	}
});

interface IdentifyData {
	redirect: string;
	userId: string;
	code: string;
	createdAt: Date;
	expiresAt: Date;
}

const IdentifyDataSchema = new Schema<IdentifyData>({
	redirect: {
		type: String,
		required: true
	},
	userId: {
		type: String,
		required: true
	},
	code: {
		type: String,
		unique: true,
		index: true,
		required: true
	},
	createdAt: {
		type: Date,
		expires: 0,
		required: true
	},
	expiresAt: {
		type: Date,
		expires: 0,
		required: true
	},
});

interface AccessToken {
	scope: Array<string>;
	token: string;
	refreshToken: string;
	subject: Types.ObjectId;
	client: Types.ObjectId;
	createdAt: Date;
	tokenExpiresAt: Date;
	refreshTokenExpiresAt: Date;
}

const AccessTokenSchema = new Schema<AccessToken>({
	scope: [{
		type: String,
		required: true
	}],
	token: {
		type: String,
		unique: true,
		required: true
	},
	refreshToken: {
		type: String,
		unique: true,
		required: true
	},
	subject: {
		type: Schema.Types.ObjectId,
		ref: REFS.USER,
		required: true
	},
	client: {
		type: Schema.Types.ObjectId,
		ref: REFS.USER,
		required: true
	},
	createdAt: {
		type: Date,
		default: Date.now,
		required: true
	},
	tokenExpiresAt: {
		type: Date,
		required: true
	},
	refreshTokenExpiresAt: {
		type: Date,
		expires: 0,
		required: true
	}
});

const AuthRequest = mongoose.model<AuthRequest>(REFS.AUTH_REQUEST, AuthRequestSchema);
const IdentifyRequest = mongoose.model<IdentifyRequest>(REFS.IDENTIFY_REQUEST, IdentifyRequestSchema);
const IdentifyData = mongoose.model<IdentifyData>(REFS.IDENTIFY_DATA, IdentifyDataSchema);
const AccessToken = mongoose.model<AccessToken>(REFS.ACCESS_TOKEN, AccessTokenSchema);

export { AuthRequest, IdentifyRequest, IdentifyData, AccessToken };