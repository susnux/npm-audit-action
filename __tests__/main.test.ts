import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatNpmAuditOutput, runNpmAudit } from '../src/main.js'

const core = vi.hoisted(() => ({
	debug: vi.fn(),
	info: vi.fn(),
}))
const childProcess = vi.hoisted(() => ({
	exec: vi.fn(),
}))
vi.mock('node:child_process', () => childProcess)
vi.mock('@actions/core', () => core)

describe('runNpmAudit', () => {
	beforeEach(() => {
		vi.resetAllMocks()
	})

	it('calls exec with correct command', async () => {
		childProcess.exec.mockImplementationOnce((command, callback) => {
			callback(null, '{}', '')
		})

		const output = await runNpmAudit(false)
		expect(output).toBe('{}')
		expect(childProcess.exec).toHaveBeenCalled()
		expect(childProcess.exec.mock.calls[0][0]).toMatch('npm audit --json')
	})

	it('calls exec with correct fix-command', async () => {
		childProcess.exec.mockImplementationOnce((command, callback) => {
			callback(null, '{}', '')
		})

		const output = await runNpmAudit(true)
		expect(output).toBe('{}')
		expect(childProcess.exec).toHaveBeenCalled()
		expect(childProcess.exec.mock.calls[0][0]).toMatch('npm audit --json fix')
	})

	it('Outputs only the JSON', async () => {
		// when fixing it also outputs the install stuff
		childProcess.exec.mockImplementationOnce((command, callback) => {
			callback(
				null,
				'add   foo  6.5.4 -> 6.5.5   \nadd   bar  0.1.0 -> 1.0.0   \n{\n}',
				'',
			)
		})

		const output = await runNpmAudit(false)
		expect(output).toBe('{\n}')
	})

	it('writes debug output', async () => {
		childProcess.exec.mockImplementationOnce((command, callback) => {
			callback(null, '{}', 'Some note')
		})

		await runNpmAudit(false)
		expect(childProcess.exec).toHaveBeenCalled()
		expect(core.debug).toHaveBeenCalledWith('[npm audit]: Some note')
	})

	it('rejects on error', async () => {
		childProcess.exec.mockImplementationOnce((command, callback) => {
			callback(new Error('Some error'), '', 'An error happened')
		})

		expect(async () => await runNpmAudit(false)).rejects.toThrowError(/Some error/)
		expect(childProcess.exec).toHaveBeenCalled()
		expect(core.debug).toHaveBeenCalledWith('[npm audit]: An error happened')
	})
})

describe('formatNpmAuditOutput', () => {
	it('formats empty output correctly', async () => {
		const data = {
			vulnerabilities: {},
		}

		const output = await formatNpmAuditOutput(data)
		expect(core.info).toHaveBeenCalledWith('Found 0 fixable issues')
		expect(output).toMatch(/# Audit report/)
		expect(output).toMatch(/No fixable problems found \(0 unfixable\)/)
	})

	it('formats output correctly for only unfixables', async () => {
		const data = {
			vulnerabilities: {
				foo: {
					isFixable: false,
				},
			},
		}

		const output = await formatNpmAuditOutput(data)
		expect(core.info).toHaveBeenCalledWith('Found 0 fixable issues')
		expect(output).toMatch(/# Audit report/)
		expect(output).toMatch(/No fixable problems found \(1 unfixable\)/)
	})
})
