import chai from 'chai'
import chaiHttp from 'chai-http'
import { app } from '../dist/index.js'
import { Permission } from '../dist/schemas/PermissionSchema.js'
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

describe('Permissions', function () {
    let token = ''
    let botUser = undefined
    let testPermission = undefined
    let testUser = undefined
    let testRole = undefined

    beforeEach(async function () {
        await User.deleteMany({})
        botUser = await (new User({
            name: 'botuser',
            permissions: ['*']
        }).save())
        botUser = botUser._doc
        token = createToken(botUser)

        await Permission.deleteMany({})
        testPermission = await (new Permission({
            name: 'testpermission',
            description: 'testdescription',
            flag: 'test.permission'
        }).save())
        testPermission = testPermission._doc

        await Role.deleteMany({})
        testRole = await (new Role({
            name: 'testrole',
            description: 'testdescription',
            permissions: ['test.permission'],
            creator: botUser._id
        }).save())
        testRole = testRole._doc

        testUser = await (new User({
            name: 'test',
            permissions: ['user.test.permission']
        }).save())
        testUser = testUser._doc
    })

    describe('/POST create', function () {
        it('return 401 without token', function (done) {
            chai.request(app)
                .post('/permission/create', botUser)
                .end((err, res) => {
                    res.should.have.status(401)
                    done()
                })
        })
        it('return created permission', function (done) {
            post('/permission/create', botUser)
                .send({
                    name: 'newpermission',
                    description: 'newdescription',
                    flag: 'new.permission'
                })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.be.a('object')
                    res.body.name.should.eq('newpermission')
                    res.body.description.should.eq('newdescription')
                    res.body.flag.should.eq('new.permission')
                    res.body.key.should.eq('permission')
                    res.body.path.should.eq('new')
                    done()
                })
        })
        it('return 400 when permission already exists', function (done) {
            post('/permission/create', botUser)
                .send({
                    name: 'newpermission',
                    description: 'newdescription',
                    flag: testPermission.flag
                })
                .end((err, res) => {
                    res.should.have.status(400)
                    done()
                })
        })
    })

    describe('/POST update', function () {
        it('return updated permission', function (done) {
            post('/permission/update', botUser)
                .send({ flag: testPermission.flag, name: 'newpermissionname' })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.be.a('object')
                    res.body.name.should.eq('newpermissionname')
                    done()
                })
        })
    })

    describe('/GET', function () {
        it('return 404 on unknown permission flag', function (done) {
            get('/permission/unknown.permission', botUser)
                .end((err, res) => {
                    res.should.have.status(404)
                    done()
                })
        })
        it('return a existing permission', function (done) {
            get(`/permission/${testPermission.flag}`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.name.should.eq(testPermission.name)
                    res.body.flag.should.eq(testPermission.flag)
                    done()
                })
        })
    })

    describe('/DELETE', function () {
        it('should return deleted permission on successful delete', function (done) {
            del(`/permission/${testPermission.flag}`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.have.property('name')
                    res.body.flag.should.eq(testPermission.flag)
                    done()
                })
        })
        it('should return 404 with unknown permission flag', function (done) {
            del('/permission/unknown.flag', botUser)
                .end((err, res) => {
                    res.should.have.status(404)
                    done()
                })
        })
        it('should return 400 with invalid permission flag', function (done) {
            del('/permission/invalid_flag', botUser)
                .end((err, res) => {
                    res.should.have.status(400)
                    done()
                })
        })
    })

    describe('/POST has', function () {
        it('return false on missing user permissions', function (done) {
            post(`/permission/has`, botUser)
                .send({
                    type: 'user',
                    id: testUser._id,
                    required: ['missing.permission'],
                    includeMissing: false
                })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.passed.should.eq(false)
                    done()
                })
        })
        it('return true on missing user permissions when additional provided', function (done) {
            post(`/permission/has`, botUser)
                .send({
                    type: 'user',
                    id: testUser._id,
                    required: ['missing.permission'],
                    additional: ['missing.?'],
                    includeMissing: false
                })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.passed.should.eq(true)
                    done()
                })
        })
        it('return false on missing role permissions', function (done) {
            post(`/permission/has`, botUser)
                .send({
                    type: 'role',
                    id: testRole._id,
                    required: ['missing.permission'],
                    includeMissing: false
                })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.passed.should.eq(false)
                    done()
                })
        })
        it('return include all missing permissions', function (done) {
            post(`/permission/has`, botUser)
                .send({
                    type: 'user',
                    id: testUser._id,
                    required: ['user.test.permission', 'other.required', 'yet.another', 'fourth.*'],
                    additional: ['other.*'],
                    includeMissing: true
                })
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.passed.should.eq(false)
                    res.body.missing.should.be.a('array')
                    res.body.missing.length.should.eq(2)
                    res.body.missing.should.contain('yet.another')
                    res.body.missing.should.contain('fourth.*')
                    done()
                })
        })
    })

    describe('/GET me', function () {
        it('should return correct permissions', function (done) {
            get(`/permission/me`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.should.be.a('array')
                    res.body.should.contain('*')
                    res.body.length.should.eq(1)
                    done()
                })
        })
    })

    describe('/GET list', async function () {
        let flag = 'test'
        for (var i = 0; i < 200; i++) {
            const p = new Permission({
                name: 'test',
                description: 'test',
                flag: flag
            })
            await p.save()
            flag += '.test'
        }
        it('should return 100 flags', function (done) {
            get(`/permission/list?limit=100&search=*`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.length.should.eq(100)
                    done()
                })
        })
        it('should return 10 flags', function (done) {
            get(`/permission/list?limit=10&search=*`, botUser)
                .end((err, res) => {
                    res.should.have.status(200)
                    res.body.length.should.eq(100)
                    done()
                })
        })
    })

})
