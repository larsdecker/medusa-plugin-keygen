import crypto from "crypto"

export default function verifyKeygenWebhook(req: any, res: any, next: any) {
  const secret = process.env.KEYGEN_WEBHOOK_SECRET
  const signature = req.headers?.["x-signature"]

  if (!secret || !signature) {
    res.status?.(401).json?.({ message: "Invalid signature" })
    return
  }

  const rawBody = req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body))
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

  const incoming = Buffer.from(signature, "hex")
  const expected = Buffer.from(computed, "hex")

  if (incoming.length === expected.length && crypto.timingSafeEqual(incoming, expected)) {
    return next()
  }

  res.status?.(401).json?.({ message: "Invalid signature" })
}
