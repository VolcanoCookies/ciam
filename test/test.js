/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prefer-arrow/prefer-arrow-functions */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import assert from 'assert';
import { Flag, flagArray, PermissionHolderType } from 'ciam-commons';
import _ from 'lodash';
import { checkPermissions, has } from '../dist/permission.js';
import { discordRoleModel } from '../dist/schemas/DiscordRoleSchema.js';
import { roleModel } from '../dist/schemas/RoleSchema.js';
import { userModel } from '../dist/schemas/UserSchema.js';

describe('permission', function () {
	let testUser;
	let testRole;
	let testDiscordRole;

	before(async () => {
		await Promise.all([
			userModel.deleteMany({
				_id: { $ne: '000000000000000000000000' },
			}),
			roleModel.deleteMany({}),
			discordRoleModel.deleteMany({}),
		]);

		const perms = [
			'some.valid.perms',
			'some.?.test',
			'testing.123.asd',
			'som.wild.*',
		].map((f) => Flag.validate(f));

		testUser = await new userModel({
			permissions: perms,
			discord: {
				id: '123',
			},
		}).save();

		testRole = await new roleModel({
			permissions: perms,
		}).save();

		testDiscordRole = await new discordRoleModel({
			permissions: perms,
			_id: '123',
			name: 'test',
		}).save();
	});

	const validFlagStrings = [
		'some.valid',
		'permissions.here.are.*',
		'*',
		'single',
		'some.?.?.ppe.*',
		'?',
		'?.ms',
	];

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
						'ciam.role.?',
					],
					invalid: [
						'ciam',
						'ciam.role',
						'ciam.role.create.new',
						'role.*',
					],
				},
			];

			for (const { required, valid, invalid } of tests) {
				for (const v of valid) {
					assert.ok(
						has(Flag.validate(required), Flag.validate(v)),
						`Failed on valid: ${v}`
					);
				}
				for (const i of invalid) {
					assert.ok(
						!has(Flag.validate(required), Flag.validate(i)),
						`Failed on invalid: ${i}`
					);
				}
			}
		});
	});

	describe('permformance', function () {
		it('performance test', async function () {
			const alpha = 'abcdefghijklmnopqrstuvwxyz';
			function randomString(len) {
				let str = '';
				for (let i = 0; i < len; i++) {
					str += alpha.charAt(_.random(alpha.length - 1));
				}
				return str;
			}

			const held = [];
			for (let i = 0; i < 100; i++) {
				let str = '';
				const r = _.random(5, 10);
				for (let j = 0; j < r; j++) {
					str += randomString(_.random(4, 32));
					if (j + 1 < r) str += '.';
				}
				held.push(str);
			}

			const required = [];
			for (let i = 0; i < 100; i++) {
				let str = '';
				const r = _.random(5, 10);
				for (let j = 0; j < r; j++) {
					str += randomString(_.random(4, 32));
					if (j + 1 < r) str += '.';
				}
				required.push(str);
			}

			const heldFlags = flagArray(held);
			const reqFlags = flagArray(required);

			testUser.permissions = heldFlags;
			await testUser.save();

			const checkResult = await checkPermissions(
				{
					id: testUser._id,
					type: PermissionHolderType.USER,
				},
				reqFlags
			);
			assert.ok(!checkResult.passed);
		});
	});
});
