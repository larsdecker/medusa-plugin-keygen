
# medusa-plugin-keygen

Medusa v2 Plugin, das beim Platzieren einer Bestellung **Lizenzen via keygen.sh** erzeugt.
Inklusive **Admin-Widgets** (Produkt & Variante) und **Admin-Serverrouten** (Validierung, Policy-Management).

## Features
- **Subscriber**: reagiert auf `order.placed`, erzeugt pro Line-Item eine Lizenz
- **Data Model**: `keygen_license` Tabelle (order_id, license_id, key, status, etc.)
- **Admin-Widgets**:
  - Produkt: `keygen_product` / `keygen_policy` setzen, Policies anzeigen/erstellen, klonen, Entitlements wählen
  - Variante: Metadaten pro Variante setzen (Override)
- **Admin-API**:
  - `POST /admin/keygen/validate`
  - `GET /admin/keygen/policies?productId=`
  - `POST /admin/keygen/policies` (inkl. Entitlements)
  - `POST /admin/keygen/policies/clone`
  - `GET /admin/keygen/entitlements`

## Installation
```bash
npm i medusa-plugin-keygen
```

In `medusa-config.ts` registrieren:
```ts
import { defineConfig } from "@medusajs/medusa"

export default defineConfig({
  plugins: [
    {
      resolve: "medusa-plugin-keygen",
      options: {
        policyMetadataKey: "keygen_policy",
        productMetadataKey: "keygen_product",
        // defaultPolicyId: "pol_123",
        // defaultProductId: "prod_123",
        timeoutMs: 12000,
      },
    },
  ],
})
```

ENV in deiner App setzen:
```
KEYGEN_ACCOUNT=your-account-or-slug
KEYGEN_TOKEN=your-api-token
```

Migrationen:
```bash
npx medusa plugin:db:generate  # im Plugin (optional)
npx medusa db:migrate         # in deiner App (führt Plugin-Migrationen aus)
```

## Admin
- Produktdetailseite: IDs setzen/validieren, Policy erstellen/klonen, Entitlements verknüpfen
- Variantenansicht: Metadaten pro Variante setzen

## Tests
```bash
npm i
npm run build
npm test
```

## Verwendung aus GitHub
- Repo erstellen (z. B. `YOUR_ORG/medusa-plugin-keygen`), Dateien pushen
- Version bumpen (SemVer), Tag setzen (z. B. `v0.1.0`)
- Optional: GitHub Release / npm publish

## Lizenz
MIT
