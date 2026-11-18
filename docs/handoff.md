# Handoff · BTP_ENVIRONMENT (phase A)

Closed so far: TOOLKIT_VERIFY, SKILLS_DISCOVERY (plus the 2 steps closed before this run). Next: BTP_ENVIRONMENT.

## What is needed, from whom, why

BTP_ENVIRONMENT is a gate that reads the development subaccount and cannot run unattended here:

- **From the developer** (once per development): choose the way to read the subaccount, btp-administration MCP (local session with SAP OAuth login) or the btp CLI.
  In this unattended cloud sandbox the MCP cannot complete the OAuth login, so the btp CLI is the only way.
- **From the developer**: accept the SAP Developer licence on https://tools.hana.ondemand.com/additional/ (the btp CLI is not installed; the agent must not accept it for them), then open the SSO address printed by
  `btp login --sso manual --url https://cli.btp.cloud.sap --subdomain <global account subdomain> --idp <IAS origin key>` and sign in (about 5 minutes validity).
- **From the developer**: run `cf login --sso` themselves (one-time passcode) and `cf target -o nova-dev-org -s nova-dev-space`, otherwise the Cloud Foundry space check stays NOT VERIFIED.
- **From the BTP administrators**: if checks answer 403, assign Global Account Viewer and Subaccount Viewer (or Administrator) to the developer's IAS user.
- **From the developer**: confirm every change (space, entitlements for destination lite, html5-apps-repo app-host, Cloud Logging, trust with the IAS tenant, SAP Build Work Zone subscription, role collections) before it is made.
  The Work Zone profile conflict (IAS trust required since 20 March 2025) must be settled as a choice before any work.

Target (PLAYBOOK.md, SAP BTP landscape): global account keytobusinesssrl, subaccount dev-emykt6ie
(83bccc77-527a-45c4-a09c-f28c31abc152), eu10, CF org nova-dev-org, space nova-dev-space, IAS https://aww4s9pgx.accounts.ondemand.com.

## Notes
- This sandbox now has btptf v1.6.0, cf 8.19.0 and the multiapps plugin; html5-plugin for cf is missing (plugins.cloudfoundry.org is not reachable); these tools do not persist to other sessions.
- sap-dependency-security plugin (`claude plugin install sap-dependency-security@nova-skills --scope project`) is for a person to install.
- Resume with: node .claude/nova/install.mjs next
