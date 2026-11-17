# Security Policy

## Supported versions

Only the latest release on
[hysys-companion-releases](https://github.com/wjgoarxiv/hysys-companion-releases/releases/latest)
receives security fixes. The app checks for new versions in Settings > Updates;
please update before reporting.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Any older release | No, please update |

## Reporting a vulnerability

Please report privately through GitHub Security Advisories:

**[Report a vulnerability](https://github.com/wjgoarxiv/hysys-companion-releases/security/advisories/new)**

Do not open a public issue for a security problem. The form above is private
between you and the maintainer.

A useful report says:

- the app version (Settings > About) and Windows version;
- what an attacker can do, and what they need first (local access, a crafted
  file, a network position);
- steps to reproduce, with a minimal case file or request if one is needed.

Remove company case files, plant data, account tokens and personal paths before
attaching anything. The problem-report log saved from Settings already strips keys
and personal paths, but check it before you send it.

## What to expect

- An acknowledgement within 7 days.
- An assessment and a planned fix or a reasoned "not a vulnerability" within
  30 days.
- Credit in the release notes if you want it.

## Scope

In scope:

- the local sidecar on `127.0.0.1` (loopback only by design) and its HTTP routes;
- the approval gate: a case change without operator confirmation and a valid
  single-use confirmation token;
- the updater: installing a file whose checksum does not match the release;
- secrets: AI account tokens or keys leaking into logs, diagnostics or files;
- the installer and the files it writes.

Out of scope:

- Aspen HYSYS itself, and problems that need administrator rights on the PC
  already;
- the AI providers' own services;
- reports without a security impact (please use
  [Issues](https://github.com/wjgoarxiv/hysys-companion-releases/issues)).
