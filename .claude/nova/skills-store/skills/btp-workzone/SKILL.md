---
name: btp-workzone
description: >
  Use when setting up SAP Build Work Zone: deploying Fiori apps to Work Zone,
  content providers, CDM (Common Data Model), role assignments, Launchpad tiles,
  HTML5 app deployment to BTP, xs-app.json app router configuration,
  managed app router, or integrating CAP + Fiori apps with SAP Build Work Zone standard edition.
metadata:
  category: btp
  version: "1.0.0"
  keywords: [SAP Build Work Zone, build-workzone-standard, HTML5 deployment, html5-apps-repo, Managed App Router, content provider, sap.cloud.service, Launchpad tile, CDM]
  related:
    btp-destinations: destinations for content federation
    fiori-navigation: Launchpad intent mappings in manifest.json
    btp-deployment: mta.yaml configuration for Work Zone
---

# BTP Work Zone — Best Practices

> **Primary reference**: https://help.sap.com/docs/build-work-zone-standard-edition
> **Deploying HTML5 apps**: https://help.sap.com/docs/build-work-zone-standard-edition/sap-build-work-zone-standard-edition/developing-html5-apps
> **Content federation from S/4HANA**: https://help.sap.com/docs/build-work-zone-standard-edition/sap-build-work-zone-standard-edition/integrating-sap-s-4hana-content

SAP Build Work Zone standard edition (formerly SAP Launchpad Service) is the central entry point for SAP Fiori apps on BTP. It hosts apps built with different UI technologies and provides navigation, personalization, and application configuration.

---

## Deploying a CAP + Fiori app to Work Zone

### Step 1: Configure HTML5 deployment in mta.yaml

```yaml
modules:
  # ── HTML5 App Deployer ───────────────────────────────────────────
  - name: my-app-html5-deployer
    type: com.sap.application.content
    path: .
    requires:
      - name: my-app-html5-repo-host
        parameters:
          content-target: true
    build-parameters:
      build-result: app/
      requires:
        - name: my-app-ui
          artifacts: ['*.zip']
          target-path: app/

  - name: my-app-ui
    type: html5
    path: app/orders
    build-parameters:
      build-result: dist
      builder: custom
      commands:
        - npm install
        - npm run build:cf
      supported-platforms: []

  # ── Content deployer for Work Zone ──────────────────────────────
  - name: my-app-workzone-deployer
    type: com.sap.application.content
    requires:
      - name: my-app-workzone
        parameters:
          service-key:
            name: my-app-workzone-key
      - name: my-app-html5-repo-host
        parameters:
          service-key:
            name: my-app-html5-repo-key
      - name: my-app-auth
    parameters:
      content:
        instance:
          destinations:
            - Name: my-app-html5-repo
              ServiceInstanceName: my-app-html5-repo-host
              ServiceKeyName: my-app-html5-repo-key
              sap.cloud.service: my.app.service
            - Name: my-app-auth
              Authentication: OAuth2UserTokenExchange
              ServiceInstanceName: my-app-auth
              ServiceKeyName: my-app-auth-key
              sap.cloud.service: my.app.service
          existing_destinations_policy: update

resources:
  - name: my-app-html5-repo-host
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-host

  - name: my-app-workzone
    type: org.cloudfoundry.managed-service
    parameters:
      service: build-workzone-standard
      service-plan: standard   # or free for trial

  - name: my-app-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
```

### Step 2: Configure xs-app.json (app router)

```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/(.*)$",
      "target": "/odata/v4/$1",
      "destination": "srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },
    {
      "source": "^/resources/(.*)$",
      "target": "/resources/$1",
      "authenticationType": "none",
      "destination": "ui5"
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

### Step 3: Configure manifest.json for Work Zone

```json
{
  "sap.cloud": {
    "public": true,
    "service": "my.app.service"
  },
  "sap.app": {
    "id": "my.app.orders",
    "crossNavigation": {
      "inbounds": {
        "Order-manage": {
          "semanticObject": "Order",
          "action": "manage",
          "title": "Manage Orders",
          "signature": {
            "parameters": {},
            "additionalParameters": "allowed"
          }
        }
      }
    }
  }
}
```

---

## Managed App Router (recommended for Work Zone)

Use the Managed Application Router instead of your own app router — it's maintained by SAP and requires no separate deployment:

```yaml
# In mta.yaml — remove your custom approuter module
# and add the managed router destination instead:
- name: my-app-workzone-deployer
  parameters:
    content:
      instance:
        destinations:
          - Name: my-app-srv-api
            URL: ~{my-app-srv/srv-url}
            TokenServiceInstanceName: my-app-auth
            TokenServiceKeyName: my-app-auth-key
            sap.cloud.service: my.app.service
            Authentication: OAuth2UserTokenExchange
```

In `xs-security.json`, add the managed router as a trusted client:
```json
{
  "oauth2-configuration": {
    "redirect-uris": [
      "https://*.launchpad.cfapps.eu10.hana.ondemand.com/**"
    ]
  }
}
```

---

## Content federation from S/4HANA

To expose S/4HANA Fiori apps in Work Zone:

1. In S/4HANA: run `/n/UI2/CDM3_EXP_SCOPE` to expose roles/catalogs
2. In BTP Cockpit: create two destinations:
   - Design-time destination (for catalog import): Basic Auth to S/4HANA ICF
   - Run-time destination (for app execution): Principal Propagation
3. In Work Zone: Channel Manager → Add Content Provider → enter both destinations
4. Fetch content → assign roles in Work Zone

---

## Role assignment in Work Zone

```
BTP Cockpit → SAP Build Work Zone → Instances and Subscriptions
→ Go to Application → Settings → Roles
→ Assign Role Collections to users or groups
```

Minimum roles for end users:
- `Launchpad_User` — access to the Work Zone site
- App-specific roles from `xs-security.json`

---

## Common mistakes to avoid

- ❌ Using your own App Router when Work Zone's Managed App Router covers the use case
- ✅ Managed App Router reduces maintenance overhead and is always up to date

- ❌ Missing `sap.cloud.service` in `manifest.json` — app doesn't appear in Work Zone content
- ✅ `sap.cloud.service` must match the value in the content deployer destinations

- ❌ Forgetting `crossNavigation.inbounds` in `manifest.json` — app has no tile in the Launchpad
- ✅ Every app needs at least one inbound with semantic object + action

- ❌ Using the same destination for both design-time and run-time content federation
- ✅ S/4HANA content federation requires two separate destinations with different auth types

- ❌ Not adding `Launchpad_User` role to end users — they can log in but see nothing
- ✅ Assign both the launchpad role and the app-specific roles
