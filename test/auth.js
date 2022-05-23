/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable object-shorthand */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-undef-init */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prefer-arrow/prefer-arrow-functions */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import chai from 'chai';
import chaiHttp from 'chai-http';
import { app } from '../dist/index.js';
import { jwtFromUser } from '../dist/utils.js';
const should = chai.should();

chai.use(chaiHttp);

const get = function (path, user) {
	return chai
		.request(app)
		.get(path)
		.auth(jwtFromUser(user), { type: 'bearer' });
};
const post = function (path, user) {
	return chai
		.request(app)
		.post(path)
		.auth(jwtFromUser(user), { type: 'bearer' });
};
const del = function (path, user) {
	return chai
		.request(app)
		.delete(path)
		.auth(jwtFromUser(user), { type: 'bearer' });
};
/*
describe('Auth', function () {
	let botUser = undefined;
	let testAccessToken = undefined;

	beforeEach(async function () {
		await userModel.deleteMany({});
		botUser = await new userModel({
			name: 'botuser',
			permissions: ['*'],
		}).save();
		botUser = botUser._doc;

		const tokenExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
		const refreshTokenExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

		await AccessToken.deleteMany({});
		testAccessToken = await new AccessToken({
			scope: 'identify',
			token: 'some-token',
			refreshToken: 'some-refresh-token',
			subject: botUser._id,
			client: botUser._id,
			createdAt: Date.now(),
			tokenExpiresAt: tokenExpiresAt,
			refreshTokenExpiresAt: refreshTokenExpiresAt,
		}).save();
		testAccessToken = testAccessToken._doc;
	});

	describe('/GET user', function () {
		it('return 400 without ciam token', function (done) {
			get('/auth/user', botUser).end((err, res) => {
				res.should.have.status(400);
				done();
			});
		});
		it('return 400 with invalid ciam token', function (done) {
			get('/auth/user', botUser)
				.set('ciam_token', 'invalid-token')
				.end((err, res) => {
					res.should.have.status(400);
					done();
				});
		});
		it('return correct user with valid ciam token', function (done) {
			get('/auth/user', botUser)
				.set('ciam_token', testAccessToken.token)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.id.should.eq(`${botUser._id}`);
					done();
				});
		});
	});

	describe('/GET refresh', function () {
		it('return 400 without refresh token', function (done) {
			get('/auth/refresh', botUser).end((err, res) => {
				res.should.have.status(400);
				done();
			});
		});
		it('return 400 with invalid refresh token', function (done) {
			get('/auth/refresh', botUser)
				.query({
					token: 'invalid-token',
				})
				.end((err, res) => {
					res.should.have.status(400);
					done();
				});
		});
		it('return new access token for correct user', function (done) {
			get('/auth/refresh', botUser)
				.query({
					refreshToken: testAccessToken.refreshToken,
				})
				.end((err, res) => {
					res.should.have.status(200);
					get('/auth/user', botUser)
						.set('ciam_token', res.body.token)
						.end((err, res) => {
							res.should.have.status(200);
							res.body.id.should.eq(`${botUser._id}`);
							done();
						});
				});
		});
	});
});
*/
