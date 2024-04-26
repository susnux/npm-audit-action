type Severity = 'info' | 'low' | 'moderate' | 'high' | 'critical'

export interface VulnerabilityReport {
	source: number
	name: string
	dependency: string
	title: string
	url: string
	severity: Severity
	cvss?: {
		score: number
		vectorString: string
	}
	range: string
}

export interface Vulnerability {
	name: string
	severity: Severity
	isDirect: boolean
	fixAvailable: boolean
	via: (VulnerabilityReport | string)[]
	range: string
	nodes: string[]
}

export interface NPMAudit {
	auditReportVersion: number
	vulnerabilities: Record<string, Vulnerability>
	metadata: {
		vulnerabilities: Record<Severity | 'total', number>
		dependencies: {
			prod: number
			dev: number
			optional: number
			peer: number
			peerOptional: number
			total: number
		}
	}
}

export interface NPMAuditFix {
	added: number
	removed: number
	changed: number
	audited: number
	funding: number
	audit: NPMAudit
}
