import assert from 'assert'
import _ from 'lodash'

import { has, hasAll, validFlag, flattenRole, flagArray } from '../dist/permission.js'
import { Model } from 'ciam-commons'

describe('permission', function () {

    const validFlagStrings = [
        'some.valid',
        'permissions.here.are.*',
        '*',
        'single',
        'some.?.?.ppe.*',
        '?',
        '?.ms'
    ]

    describe('#validFlag()', function () {
        it('should detect invalid permission flags', function () {
            const invalid = [
                'some.invalid.permissions.',
                'more.invalid.*.perms',
                '.',
                '',
                '.test',
                '.test.test.',
                'with.invalid1.123!½.charS',
                'more.$.e',
                'mor?'
            ]

            for (const i of invalid) {
                assert.ok(!validFlag(i), `Invalid flag passed: ${i}`)
            }
        })

        it('should detect "*" as a valid permission', function () {
            assert.ok(validFlag('*'))
        })

        it('should detect valid permission flags', function () {
            for (const v of validFlagStrings) {
                assert.ok(validFlag(v))
            }
        })

        it('should correctly detect wildcards', function () {
            const wildcards = [
                '*',
                'test.*',
                's.o.m.e.*'
            ]

            for (const w of wildcards) {
                assert.equal(Model.Flag.validate(w).isWildcard, true)
            }
        })
    })

    describe('Flag', function () {
        describe('#validate()', function () {
            it('Create Flag class from correct permission flag strings', function () {
                for (const v of validFlagStrings) {
                    assert.ok(Model.Flag.validate(v))
                }
            })
        })
    })

    describe('#flattenRole()', function () {
        it('should return correct permissions from role', function () {
            const role = {
                permissions: [
                    'some.valid.permissions',
                    'some.invalid.',
                    'valid',
                    '*',
                    '.'
                ]
            }

            const res = Array.from(flattenRole(role))

            assert.equal(res.length, 3)
            assert.equal(res[0], 'some.valid.permissions')
            assert.equal(res[1], 'valid')
            assert.equal(res[2], '*')
        })
    })

    describe('#has()', function () {
        it('should correctly pass or fail individual permission checks', function () {
            const tests = [
                {
                    required: 'ciam.role.create',
                    valid: [
                        'ciam.role.create',
                        'ciam.role.*',
                        'ciam.*',
                        '*',
                        '?.*',
                        'ciam.?.create',
                        'ciam.role.?'
                    ],
                    invalid: [
                        'ciam',
                        'ciam.role',
                        'ciam.role.create.new',
                        'role.*'
                    ]
                }
            ]

            for (const { required, valid, invalid } of tests) {
                for (const v of valid) {
                    assert.ok(has(Model.Flag.validate(required), Model.Flag.validate(v)), `Failed on valid: ${v}`)
                }
                for (const i of invalid) {
                    assert.ok(!has(Model.Flag.validate(required), Model.Flag.validate(i)), `Failed on invalid: ${i}`)
                }
            }

        })
    })

    describe('#hasAll()', function () {


    })

    describe('permformance', function () {
        it('performance test', function () {
            const alpha = 'abcdefghijklmnopqrstuvwxyz'
            function randomString(len) {
                var str = ''
                for (var i = 0; i < len; i++) {
                    str += alpha.charAt(_.random(alpha.length - 1))
                }
                return str
            }

            const held = new Array()
            for (var i = 0; i < 100; i++) {
                var str = ''
                const r = _.random(5, 10)
                for (var j = 0; j < r; j++) {
                    str += randomString(_.random(4, 32))
                    if (j + 1 < r) str += '.'
                }
                held.push(str)
            }

            const required = new Array()
            for (var i = 0; i < 100; i++) {
                var str = ''
                const r = _.random(5, 10)
                for (var j = 0; j < r; j++) {
                    str += randomString(_.random(4, 32))
                    if (j + 1 < r) str += '.'
                }
                required.push(str)
            }

            const heldFlags = flagArray(held)
            const reqFlags = flagArray(required)
            assert.ok(!hasAll(reqFlags, heldFlags).passed)
        })
    })

})