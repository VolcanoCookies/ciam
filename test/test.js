import assert from 'assert'

import { validate, flattenRole } from '../dist/permission.js'

describe('permission', function () {
    describe('#validate()', function () {

        it('should return undefined when supplied with invalid permissions', function () {
            const invalid = [
                'some.invalid.permissions.',
                'more.invalid.*.perms',
                '.',
                '',
                '0',
                '.test',
                '.test.test.'
            ]

            for (const i of invalid) {
                assert.equal(validate(i), undefined)
            }
        })

        it('should detect "*" as a valid permission', function () {
            assert.notEqual(validate('*'), undefined)
        })

        it('should return ValidatedPermissions when supplied with valid permissions', function () {
            const valid = [
                'some.valid',
                'permissions.here.are.*',
                '*',
                'single',
            ]

            for (const v of valid) {
                assert.notEqual(validate(v), undefined)
            }
        })

        it('should correctly detect wildcards', function () {
            const wildcards = [
                '*',
                'test.*',
                's.o.m.e.*'
            ]

            for (const w of wildcards) {
                assert.equal(validate(w).wildcard, true)
            }
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
            assert.equal(res[0].raw, 'some.valid.permissions')
            assert.equal(res[1].raw, 'valid')
            assert.equal(res[2].raw, '*')
        })
    })

    describe('#has()', function () {
        const required = new Set([
            'ciam.role.create',
            'ciam.role.view'
        ].map(p => validate(p)))

        it('should return true for having correct permissions', function () {
            const current = [
                'ciam.role.*'
            ]

            assert.ok(has())
        })

    })
})