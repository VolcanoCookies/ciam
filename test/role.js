import chai from 'chai'
import chaiHttp from 'chai-http'
import { app } from '../dist/index.js'
import { Role } from '../dist/schemas/RoleSchema.js'
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

describe('Roles', function () {
    let token = ''
    let botUser = undefined
    let testRole = undefined

    beforeEach(async function () {
        await User.deleteMany({})
        botUser = await (new User({
            name: 'botuser',
            permissions: ['*']
        }).save())
        botUser = botUser._doc
        token = createToken(botUser)

        await Role.deleteMany({})
        testRole = await (new Role({
            name: 'testrole',
            description: 'testdescription',
            permissions: ['test.permission'],
            creator: botUser._id
        }).save())
        testRole = testRole._doc
    })

    describe('/POST create', function () {
        it('return 401 without token', function (done) {
            chai.request(app)
                .post('/role/create', botUser)
                .send({})
                .end((err, res) => {
                    res.should.have.status(401)
                    done()
                })
        })
        it('return created role', function (done) {
            post('/role/create', botUser)
                .send({
                    name: 'newrole',
                    description: 'newdescription',
                    permissions: ['ea']
                })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.be.a('object')
                    res.body.name.should.eq('newrole')
                    res.body.description.should.eq('newdescription')
                    res.body.permissions.should.contain('ea')
                    res.body.creator.should.eq(`${botUser._id}`)
                    done()
                })
        })
    })

    describe('/POST update', function () {
        it('return updated role', function (done) {
            post('/role/update', botUser)
                .send({ _id: testRole._id, name: 'newrolename' })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.be.a('object')
                    res.body.name.should.eq('newrolename')
                    done()
                })
        })
    })

    describe('/GET', function () {
        it('return 404 on unknown role id', function (done) {
            get('/role/aaaaaaaaaaaaaaaaaaaaaaaa', botUser)
                .end((err, res) => {
                    res.should.have.status(404)
                    done()
                })
        })
        it('return a existing role', function (done) {
            get(`/role/${testRole._id}`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body._id.should.eq(`${testRole._id}`)
                    res.body.name.should.eq(testRole.name)
                    done()
                })
        })
    })

    describe('/DELETE', function () {
        it('should return deleted role on successful delete', function (done) {
            del(`/role/${testRole._id}`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.have.property('name')
                    res.body._id.should.eq(`${testRole._id}`)
                    done()
                })
        })
        it('should return 404 with unknown role id', function (done) {
            del(`/role/${botUser._id}`, botUser)
                .end((err, res) => {
                    console.log(res)
                    res.should.have.status(404)
                    done()
                })
        })
        it('should return 400 with invalid role id', function (done) {
            del('/role/invalid', botUser)
                .end((err, res) => {
                    res.should.have.status(400)
                    done()
                })
        })
    })

})
