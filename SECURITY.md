# Security Policy

## Reporting a vulnerability

Open a private security advisory on the repository (GitHub private vulnerability reporting: the repository's **Security** tab, then **Report a vulnerability**). Do not open public issues for suspected vulnerabilities.

- Response target from report to coordinated fix and published advisory: 90 days.
- Reports involving client personal data must not include the data itself. Describe the data class, record identifiers, and reproduction steps against synthetic data.

## Scope

In scope: every package in the monorepo (`apps/`, `packages/`) and the infrastructure code (`infra/terraform`). Deployments running modified forks are out of scope; report against the upstream code.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

Only the latest patch release of a supported minor line receives security fixes.

## Disclosure policy

Disclosure is coordinated. Fixes are released as patch versions of the affected package, and an advisory (with a CVE identifier where the fix warrants one) is published after the release is available. Reporters are credited in the advisory unless they request otherwise.
