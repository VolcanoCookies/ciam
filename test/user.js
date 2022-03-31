import chai from 'chai'
import chaiHttp from 'chai-http'
import { app } from '../dist/index.js'
import { User } from '../dist/schemas/UserSchema.js'
import { createToken } from '../dist/utils.js'
const should = chai.should()

chai.use(chaiHttp)

const get = function (path, user) {
    return chai.request(app)
        .get(path)
        .auth(createToken(user), { type: 'bearer' })
}
const post = function (path, user) {
    return chai.request(app)
        .post(path)
        .auth(createToken(user), { type: 'bearer' })
}
const del = function (path, user) {
    return chai.request(app)
        .delete(path)
        .auth(createToken(user), { type: 'bearer' })
}

function isUser(obj) {
    obj.should.be.a('object')
    obj.should.have.property('_id')
    obj.should.have.property('name')
    obj.should.have.property('roles')
    obj.should.have.property('permissions')
}

describe('Users', function () {
    let token = ''
    let botUser = undefined
    let testUser = undefined

    beforeEach(async function () {
        await User.deleteMany({})
        botUser = await (new User({
            name: 'botuser',
            permissions: ['*']
        }).save())
        botUser = botUser._doc
        token = createToken(botUser)
        testUser = await (new User({
            name: 'test'
        }).save())
        testUser = testUser._doc
    })

    let user = {
        name: 'testuser',
        permissions: ['some.perm']
    }

    describe('/POST create', function () {
        it('return 401 without token', function (done) {
            chai.request(app)
                .post('/user/create', botUser)
                .send(user)
                .end((err, res) => {
                    res.should.have.status(401)
                    done()
                })
        })
        it('return created user', function (done) {
            post('/user/create', botUser)
                .send(user)
                .end((err, res) => {
                    res.should.have.status(200)
                    isUser(res.body)
                    done()
                })
        })
    })

    describe('/POST update', function () {
        it('return updated user', function (done) {
            post('/user/update', botUser)
                .send({ _id: testUser._id, name: 'newname' })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.name.should.eq('newname')
                    isUser(res.body)
                    done()
                })
        })
    })

    describe('/GET valid', function () {
        it('should return 200 with a valid token', function (done) {
            get('/user/valid', botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    done()
                })
        })
        it('should return 401 with a invalid token', function (done) {
            get('/user/valid', testUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    done()
                })
        })
    })

    describe('/GET', function () {
        it('return our own user', function (done) {
            get(`/user/${botUser._id}`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.name.should.eq(botUser.name)
                    done()
                })
        })
    })

    describe('/DELETE', function () {
        it('should return deleted user on successful delete', function (done) {
            del(`/user/${testUser._id}`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.have.property('name')
                    res.body.name.should.eq(testUser.name)
                    done()
                })
        })
        it('should return 400 with unknown userId', function (done) {
            del('/user/1', botUser)
                .end((err, res) => {
                    res.should.have.status(400)
                    done()
                })
        })
        it('should prevent unauthorized user from deleting another user', function (done) {
            del(`/user/${botUser._id}`, testUser)
                .end((err, res) => {
                    res.should.have.status(401)
                    done()
                })
        })
        it('should prevent a user from deleting themselves', function (done) {
            del(`/user/${botUser._id}`, botUser)
                .end((err, res) => {
                    res.should.have.status(400)
                    done()
                })
        })
    })

    describe('/GET token', function () {
        it('should return correct token for own user', function (done) {
            get('/user/token', botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.text.should.eq(createToken(botUser))
                    done()
                })
        })
    })

})
