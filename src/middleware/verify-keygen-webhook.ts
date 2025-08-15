import crypto from "crypto"

export default function verifyKeygenWebhook(req: any, res: any, next: any) {
  const secret = process.env.KEYGEN_WEBHOOK_SECRET
  const signature = req.headers?.["x-signature"]

  if (!secret || !signature) {
    res.status?.(401).json?.({ message: "Invalid signature" })
    return
  }

  const rawBody =
    typeof req.rawBody === "string" || Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : typeof req.body === "string"
      ? req.body
      : undefined

  if (!rawBody) {
    res.status?.(400).json?.({ message: "Missing raw body" })
    return
  }

  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

  const incoming = Buffer.from(signature, "hex")
  const expected = Buffer.from(computed, "hex")

  if (incoming.length === expected.length && crypto.timingSafeEqual(incoming, expected)) {
    return next()
  }

  res.status?.(401).json?.({ message: "Invalid signature" })
}
