import mongoose, { Types } from 'mongoose';
import { REFS } from './refs.js';

const Schema = mongoose.Schema;

type scope = 'identify';

interface AuthRequest {
	scope: scope;
	redirect: string;
	domain: string;
	createdAt: Date;
	expiresAt: Date;
	state: string;
	client: Types.ObjectId;
}

const AuthRequestSchema = new Schema<AuthRequest>({
	scope: { type: String },
	redirect: { type: String },
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
	state: {
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

interface AccessToken {
	scope: scope;
	token: string;
	refreshToken: string;
	subject: Types.ObjectId;
	client: Types.ObjectId;
	createdAt: Date;
	tokenExpiresAt: Date;
	refreshTokenExpiresAt: Date;
}

const AccessTokenSchema = new Schema<AccessToken>({
	scope: {
		type: String,
		required: true
	},
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
const AccessToken = mongoose.model<AccessToken>(REFS.ACCESS_TOKEN, AccessTokenSchema);

export { AuthRequest, AccessToken };