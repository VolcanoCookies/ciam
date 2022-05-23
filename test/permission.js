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
import { PermissionHolderType } from 'ciam-commons';
import { describe } from 'mocha';
import { app } from '../dist/index.js';
import { discordRoleModel } from '../dist/schemas/DiscordRoleSchema.js';
import { permissionModel } from '../dist/schemas/PermissionSchema.js';
import { roleModel } from '../dist/schemas/RoleSchema.js';
import { userModel } from '../dist/schemas/UserSchema.js';
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
const patch = function (path, user) {
	return chai
		.request(app)
		.patch(path)
		.auth(jwtFromUser(user), { type: 'bearer' });
};

describe('Permissions', function () {
	let botUser = undefined;
	let testPermission = undefined;
	let testRole = undefined;
	let testUser = undefined;
	let testDiscordRole = undefined;

	let testUserHolder;
	let testRoleHolder;
	let testDiscordUserHolder;
	let testDiscordRoleHolder;

	beforeEach(async function () {
		await Promise.all([
			userModel.deleteMany({}),
			roleModel.deleteMany({}),
			permissionModel.deleteMany({}),
			discordRoleModel.deleteMany({}),
		]);

		const botUserPromise = new userModel({
			name: 'botuser',
			permissions: ['*'],
		}).save();

		const testPermissionPromise = new permissionModel({
			name: 'testpermission',
			description: 'testdescription',
			flag: 'test.permission',
		}).save();

		const testRolePromise = new roleModel({
			name: 'testrole',
			description: 'testdescription',
			permissions: ['test.permission'],
		}).save();

		const testUserPromise = new userModel({
			name: 'test',
			permissions: ['test.permission'],
			discord: {
				id: '123',
			},
		}).save();

		const testDiscordRolePromise = new discordRoleModel({
			_id: '123',
			guildId: '123',
			name: 'testdiscordrole',
			permissions: ['test.permission'],
		}).save();

		botUser = (await botUserPromise)._doc;
		testPermission = (await testPermissionPromise)._doc;
		testRole = (await testRolePromise)._doc;
		testUser = (await testUserPromise)._doc;
		testDiscordRole = (await testDiscordRolePromise)._doc;

		testUserHolder = {
			id: testUser._id,
			type: PermissionHolderType.USER,
		};

		testDiscordUserHolder = {
			id: testUser.discord.id,
			type: PermissionHolderType.DISCORD_USER,
		};

		testRoleHolder = {
			id: testRole._id,
			type: PermissionHolderType.ROLE,
		};

		testDiscordRoleHolder = {
			id: testDiscordRole._id,
			type: PermissionHolderType.DISCORD_ROLE,
		};
	});

	describe('/POST', function () {
		it('return 401 without token', function (done) {
			chai.request(app)
				.post('/permission', botUser)
				.end((err, res) => {
					res.should.have.status(401);
					done();
				});
		});
		it('return created permission', function (done) {
			post('/permission', botUser)
				.send({
					name: 'newpermission',
					description: 'newdescription',
					flag: 'new.permission',
				})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.name.should.eq('newpermission');
					res.body.description.should.eq('newdescription');
					res.body.flag.should.eq('new.permission');
					res.body.key.should.eq('permission');
					res.body.path.should.eq('new');
					done();
				});
		});
		it('return 400 when permission already exists', function (done) {
			post('/permission', botUser)
				.send({
					name: 'newpermission',
					description: 'newdescription',
					flag: testPermission.flag,
				})
				.end((err, res) => {
					res.should.have.status(400);
					done();
				});
		});
	});

	describe('/PATCH', function () {
		it('return updated permission', function (done) {
			patch('/permission', botUser)
				.send({ flag: testPermission.flag, name: 'newpermissionname' })
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					res.body.name.should.eq('newpermissionname');
					done();
				});
		});
	});

	describe('/POST upsert', function () {
		it('create new permission', function (done) {
			post('/permission/upsert', botUser)
				.send({
					flag: 'new.perm.flag',
					name: 'newpermissionnametest',
					description: 'somedescr',
				})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					res.body.name.should.eq('newpermissionnametest');
					res.body.flag.should.eq('new.perm.flag');
					done();
				});
		});
		it('update existing permission', function (done) {
			post('/permission/upsert', botUser)
				.send({
					flag: testPermission.flag,
					name: 'newpermissionnametest',
					description: 'somedescr',
				})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					res.body.name.should.eq('newpermissionnametest');
					res.body.flag.should.eq(testPermission.flag);
					done();
				});
		});
	});

	describe('/GET', function () {
		it('return 404 on unknown permission flag', function (done) {
			get('/permission/unknown.permission', botUser).end((err, res) => {
				res.should.have.status(404);
				done();
			});
		});
		it('return a existing permission', function (done) {
			get(`/permission/${testPermission.flag}`, botUser).end(
				(err, res) => {
					res.should.have.status(200);
					res.body.name.should.eq(testPermission.name);
					res.body.flag.should.eq(testPermission.flag);
					done();
				}
			);
		});
	});

	describe('/DELETE', function () {
		it('should return deleted permission on successful delete', function (done) {
			del(`/permission/${testPermission.flag}`, botUser).end(
				(err, res) => {
					res.should.have.status(200);
					res.body.should.have.property('name');
					res.body.flag.should.eq(testPermission.flag);
					done();
				}
			);
		});
		it('should return 404 with unknown permission flag', function (done) {
			del('/permission/unknown.flag', botUser).end((err, res) => {
				res.should.have.status(404);
				done();
			});
		});
		it('should return 400 with invalid permission flag', function (done) {
			del('/permission/invalid_flag', botUser).end((err, res) => {
				res.should.have.status(400);
				done();
			});
		});
	});

	describe('/POST check', function () {
		describe('return false on missing permissions', function () {
			const requiredPermissions = [
				'test.permission',
				'other.required',
				'yet.another',
				'fourth.*',
			];

			const expectedChecks = [
				{
					flag: 'test.permission',
					passed: true,
					onCooldown: false,
				},
				{
					flag: 'other.required',
					passed: false,
					onCooldown: false,
				},
				{
					flag: 'yet.another',
					passed: false,
					onCooldown: false,
				},
				{
					flag: 'fourth.*',
					passed: false,
					onCooldown: false,
				},
			];

			it('user holder', function (done) {
				post(`/permission/check`, botUser)
					.send({
						holder: testUserHolder,
						required: requiredPermissions,
					})
					.end((err, res) => {
						res.should.have.status(200);
						res.body.allPassed.should.eq(false);
						res.body.onCooldown.should.eq(false);
						res.body.checks.should.deep.eq(expectedChecks);
						done();
					});
			});

			it('role holder', function (done) {
				post(`/permission/check`, botUser)
					.send({
						holder: testRoleHolder,
						required: requiredPermissions,
					})
					.end((err, res) => {
						res.should.have.status(200);
						res.body.allPassed.should.eq(false);
						res.body.onCooldown.should.eq(false);
						res.body.checks.should.deep.eq(expectedChecks);
						done();
					});
			});

			it('discord user holder', function (done) {
				post(`/permission/check`, botUser)
					.send({
						holder: testDiscordUserHolder,
						required: requiredPermissions,
					})
					.end((err, res) => {
						res.should.have.status(200);
						res.body.allPassed.should.eq(false);
						res.body.onCooldown.should.eq(false);
						res.body.checks.should.deep.eq(expectedChecks);
						done();
					});
			});

			it('discord role holder', function (done) {
				post(`/permission/check`, botUser)
					.send({
						holder: testDiscordRoleHolder,
						required: requiredPermissions,
					})
					.end((err, res) => {
						res.should.have.status(200);
						res.body.allPassed.should.eq(false);
						res.body.onCooldown.should.eq(false);
						res.body.checks.should.deep.eq(expectedChecks);
						done();
					});
			});
		});

		/*	it('return true on missing user permissions when additional provided', function (done) {
			post(`/permission/has`, botUser)
				.send({
					holder: testUserHolder,
					required: ['missing.permission'],
					additional: ['missing.?'],
				})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.passed.should.eq(true);
					done();
				});
		}); */
	});

	describe('/GET me', function () {
		it('should return correct permissions', function (done) {
			get(`/permission/me`, botUser).end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('array');
				res.body.should.contain('*');
				res.body.length.should.eq(1);
				done();
			});
		});
	});

	describe('/GET list', async function () {
		let flag = 'test';
		for (let i = 0; i < 200; i++) {
			const p = new permissionModel({
				name: 'test',
				description: 'test',
				flag: flag,
			});
			await p.save();
			flag += '.test';
		}
		it('should return 100 flags', function (done) {
			get(`/permission/list?limit=100&search=*`, botUser).end(
				(err, res) => {
					res.should.have.status(200);
					res.body.length.should.eq(100);
					done();
				}
			);
		});
		it('should return 10 flags', function (done) {
			get(`/permission/list?limit=10&search=*`, botUser).end(
				(err, res) => {
					res.should.have.status(200);
					res.body.length.should.eq(100);
					done();
				}
			);
		});
	});
});
