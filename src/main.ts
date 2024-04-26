import type { NPMAudit, NPMAuditFix, Vulnerability, VulnerabilityReport } from './npm-audit'

import { exec } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import * as core from '@actions/core'

import 'css.escape'

function isFixable(data: Vulnerability): data is Vulnerability & { fixAvailable: true } {
	return typeof data === 'object' && 'fixAvailable' in data && data.fixAvailable
}

function isReport(data: string | VulnerabilityReport): data is VulnerabilityReport {
	return typeof data === 'object' && !!data.title
}

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
			resolve(stdout.slice(stdout.indexOf('{')))
		}),
	)
}

/**
 * Format "npm audit --json" output as Markdown
 * @param json The output JSON string
 * @return Formatted output as markdown
 */
export async function formatNpmAuditOutput(data: NPMAudit) {
	const fixable = Object.values(data.vulnerabilities).filter(isFixable)
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
		const info = vul.via.find(isReport)
		output += `\n### ${vul.name} <a href="#user-content-${CSS.escape(vul.name)}" id="${CSS.escape(vul.name)}">#</a>\n`

		if (info) {
			const cvss = info.cvss?.score ? ` (CVSS ${info.cvss?.score})` : ''
			output += `* ${info.title}\n`
			output += `* Severity: **${info.severity}**${info.severity === 'critical' ? ' 🚨' : ''}${cvss}\n`
			output += `* Reference: [${info.url}](${info.url})\n`
		} else {
			output += `* Caused by vulnerable dependency:\n`
			for (const via of vul.via as string[]) {
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

// Typescript helper
const isNPMAuditFix = (data: NPMAudit | NPMAuditFix): data is NPMAuditFix => 'audit' in data

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

		const output = await runNpmAudit(fix)
		let data: NPMAudit | NPMAuditFix = JSON.parse(output)
		if (isNPMAuditFix(data)) {
			data = data as NPMAuditFix
			// Print some information
			core.info(`[npm audit] Added   ${data.added} packages`)
			core.info(`[npm audit] Removed ${data.removed} packages`)
			core.info(`[npm audit] Changed ${data.changed} packages`)
			core.info(`[npm audit] Audited ${data.audited} packages`)
			// Set data to the audit report
			data = data.audit
		}

		const issues = Object.values(data.vulnerabilities)
		const totalIssues = issues.length
		const fixableIssues = issues.filter(isFixable).length
		core.setOutput('issues-total', totalIssues)
		core.setOutput('issues-fixable', fixableIssues)
		core.setOutput('issues-unfixable', totalIssues - fixableIssues)

		const formattedOutput = await formatNpmAuditOutput(data)
		core.setOutput('markdown', formattedOutput)

		if (outputPath) {
			const resolvedPath = resolvePath(outputPath)
			if (!resolvedPath.startsWith(resolvePath(process.env.GITHUB_WORKSPACE))) {
				core.setFailed('Invalid "output-path"')
				return
			}
			await writeFile(resolvedPath, formattedOutput)
		}
	} catch (error) {
		// Fail the workflow run if an error occurs
		core.setFailed(error.message)
	}
}
