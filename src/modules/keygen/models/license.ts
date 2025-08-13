
import { model } from "@medusajs/framework/utils"

const KeygenLicense = model.define("keygen_license", {
  id: model.id().primaryKey(),
  order_id: model.text().index("IDX_KEYGEN_ORDER"),
  order_item_id: model.text().nullable(),
  customer_id: model.text().nullable(),
  keygen_license_id: model.text().nullable().index("IDX_KEYGEN_LICENSE_ID"),
  license_key: model.text().nullable().searchable(),
  status: model.enum(["created", "suspended", "revoked"]).default("created"),
  keygen_policy_id: model.text().nullable(),
  keygen_product_id: model.text().nullable(),
  notes: model.text().nullable(),
})

export default KeygenLicense
