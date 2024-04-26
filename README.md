# NPM audit action

[![CodeQL](https://github.com/susnux/npm-audit-action/actions/workflows/codeql-analysis.yml/badge.svg?branch=main&event=push)](https://github.com/susnux/npm-audit-action/actions/workflows/codeql-analysis.yml)
![CI](https://github.com/susnux/npm-audit-action/actions/workflows/ci.yml/badge.svg)

<!-- ![Coverage](./badges/coverage.svg) -->

This action allows to run `npm audit` and creats a Markdown formatted output from it, it also allows to run `npm audit fix` afterwards.
The idea is to run this action together with the [create-pull-request](https://github.com/marketplace/actions/create-pull-request) action.

## Usage

```yaml
- uses: actions/checkout@v4

- name: Run NPM audit
  id: npm-audit
  uses: susnux/npm-audit-action
  with:
      # Optionally set an output path
      - output-path: pr-content.md

- name: Create Pull Request
  uses: peter-evans/create-pull-request@v6
  with:
      - body: { { steps.npm-audit.outputs.markdown } }
      # Alternativly use the output file
      - body-path: pr-content.md
```

### Action inputs

| Name                | Description                                   | Default                       |
| ------------------- | --------------------------------------------- | ----------------------------- |
| `fix`               | If `npm audit fix` should be executed instead | `true`                        |
| `output-path`       | Output path for formatted markdown            | By default no file is created |
| `working-directory` | Path to run `npm audit`                       | `GITHUB_WORKSPACE`            |

### Action outputs

| Name               | Description                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `markdown`         | The formatted markdown output                                                               |
| `issues-fixed`     | Number of issues fixed, only set if input value `fix` was not set to `false`                |
| `issues-fixable`   | Number of issues fixable with `npm audit fix` (same as `issues-fixed` if `fix` was enabled) |
| `issues-unfixable` | Number of issues not fixable with `npm audit fix`                                           |
