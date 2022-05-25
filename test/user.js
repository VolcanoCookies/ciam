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

function isUser(obj) {
	obj.should.be.a('object');
	obj.should.have.property('_id');
	obj.should.have.property('name');
	obj.should.have.property('roles');
	obj.should.have.property('permissions');
}

describe('Users', function () {
	let token = '';
	let botUser = undefined;
	let testUser = undefined;

	beforeEach(async function () {
		await userModel.deleteMany({
			_id: { $ne: '000000000000000000000000' },
		});
		botUser = await new userModel({
			name: 'botuser',
			permissions: ['*'],
		}).save();
		botUser = botUser._doc;
		token = jwtFromUser(botUser);
		testUser = await new userModel({
			name: 'test',
		}).save();
		testUser = testUser._doc;
	});

	const user = {
		name: 'testuser',
		permissions: ['some.perm'],
	};

	describe('/POST', function () {
		it('return 401 without token', function (done) {
			chai.request(app)
				.post('/user', botUser)
				.send(user)
				.end((err, res) => {
					res.should.have.status(401);
					done();
				});
		});
		it('return created user', function (done) {
			post('/user', botUser)
				.send(user)
				.end((err, res) => {
					res.should.have.status(200);
					isUser(res.body);
					done();
				});
		});
	});

	describe('/PATCH', function () {
		it('return updated user', function (done) {
			patch('/user', botUser)
				.send({ _id: testUser._id, name: 'newname' })
				.end((err, res) => {
					res.should.have.status(200);
					res.body.name.should.eq('newname');
					isUser(res.body);
					done();
				});
		});
	});

	describe('/GET', function () {
		it('return our own user', function (done) {
			get(`/user/${botUser._id}`, botUser).end((err, res) => {
				res.should.have.status(200);
				res.body.name.should.eq(botUser.name);
				done();
			});
		});
	});

	describe('/DELETE', function () {
		it('should return deleted user on successful delete', function (done) {
			del(`/user/${testUser._id}`, botUser).end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property('name');
				res.body.name.should.eq(testUser.name);
				done();
			});
		});
		it('should return 400 with unknown userId', function (done) {
			del('/user/1', botUser).end((err, res) => {
				res.should.have.status(400);
				done();
			});
		});
		it('should prevent unauthorized user from deleting another user', function (done) {
			del(`/user/${botUser._id}`, testUser).end((err, res) => {
				res.should.have.status(401);
				done();
			});
		});
		it('should prevent a user from deleting themselves', function (done) {
			del(`/user/${botUser._id}`, botUser).end((err, res) => {
				res.should.have.status(400);
				done();
			});
		});
	});

	/*
    describe('/GET token', function () {
        it('should return correct token for own user', function (done) {
            get('/user/token', botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.text.should.eq(jwtFromUser(botUser))
                    done()
                })
        })
    })
    */
});
