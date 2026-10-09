# Security Policy

## Reporting a vulnerability

Do not report suspected vulnerabilities in public issues or pull requests. Contact the maintainers through the repository's private security advisory channel or the security contact published by YieldBridge Labs. Include the affected contract and version, a concise impact assessment, and reproducible details when doing so will not expose users to additional risk.

The maintainers will acknowledge a report as promptly as practical, coordinate a private fix and disclosure timeline with the reporter, and publish remediation guidance after affected deployments can be protected. Do not include private keys, account secrets, or user-identifying data in a report.

## Deployment considerations

Contract code and administrator actions can affect deposited assets. Review changes independently, test on Stellar test networks, verify uploaded WASM hashes and factory configuration, and use controlled multisignature administration for production deployments. An audit or CI pass is not a guarantee that a deployment is secure.
