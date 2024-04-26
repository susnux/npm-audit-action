import { exec } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import core from '@actions/core'

import 'css.escape'

/**
 * Run "npm audit" and return the stdout of that operation
 * @param fix If "npm audit fix" should be executed
 */
export function runNpmAudit(fix = false): Promise<string> {
	core.debug(`Running npm audit ${fix ? 'fix' : ''}…`)

	return new Promise((resolve, reject) =>
		exec(`npm audit --json ${fix ? 'fix' : ''}`, (error, stdout, stderr) => {
			if (stderr) {
				core.debug(`[npm audit]: ${stderr}`)
			}
			if (error) {
				reject(error)
				return
			}
			resolve(stdout)
		}),
	)
}

/**
 * Format "npm audit --json" output as Markdown
 * @param json The output JSON string
 * @return Formatted output as markdown
 */
export async function formatNpmAuditOutput(json: string) {
	const data = JSON.parse(json)

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fixable = Object.values<any>(data.vulnerabilities).filter(
		({ fixAvailable }) => fixAvailable,
	)
	core.info(`Found ${fixable.length} fixable issues`)

	let output = '# Audit report\n'
	if (fixable.length === 0) {
		return `${output}No fixable problems found (${Object.values(data.vulnerabilities).length} unfixable)`
	}

	output += `
This audit fix resolves ${fixable.length} of the total ${Object.values(data.vulnerabilities).length} vulnerabilities found in your project.

## Updated dependencies
`
	for (const vul of fixable) {
		output += `* [${vul.name}](#user-content-${CSS.escape(vul.name)})\n`
	}

	output += '## Fixed vulnerabilities\n'
	for (const vul of fixable) {
		const info = vul.via.find(
			(via: string | { title: string }) => typeof via === 'object' && via.title,
		)
		output += `\n### ${vul.name} <a href="#user-content-${CSS.escape(vul.name)}" id="${CSS.escape(vul.name)}">#</a>\n`

		if (info) {
			const cvss = info.cvss?.score ? ` (CVSS ${info.cvss?.score})` : ''
			output += `* ${info.title}\n`
			output += `* Severity: **${info.severity}**${info.severity === 'critical' ? ' 🚨' : ''}${cvss}\n`
			output += `* Reference: [${info.url}](${info.url})\n`
		} else {
			output += `* Caused by vulnerable dependency:\n`
			for (const via of vul.via) {
				output += `  * [${via}](#user-content-${CSS.escape(via)})\n`
			}
		}
		output += `* Affected versions: ${vul.range}\n`
		output += '* Package usage:\n'
		for (const node of vul.nodes) {
			output += `  * \`${node}\`\n`
		}
	}
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
	try {
		const wd =
			core.getInput('working-directory', { required: false }) ||
			process.env.GITHUB_WORKSPACE
		const outputPath = core.getInput('output-path', { required: false })
		const fix = core.getBooleanInput('fix', { required: false })

		// Setup environment by switching the working directory
		const resolvedWD = resolvePath(wd)
		core.debug(`Setting working directory to "${resolvedWD}".`)
		process.chdir(resolvedWD)

		const output = await runNpmAudit()
		const formattedOutput = await formatNpmAuditOutput(output)
		core.setOutput('markdown', formattedOutput)

		if (outputPath) {
			const resolvedPath = resolvePath(outputPath)
			if (!resolvedPath.startsWith(resolvePath(process.env.GITHUB_WORKSPACE))) {
				core.setFailed('Invalid "output-path"')
				return
			}
			await writeFile(resolvedPath, formattedOutput)
		}

		if (fix) {
			await runNpmAudit(true)
		}
	} catch (error) {
		// Fail the workflow run if an error occurs
		core.setFailed(error.message)
	}
}
