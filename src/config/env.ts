import { z } from 'zod'

const envSchema = z.object({
  KEYGEN_ACCOUNT: z.string().min(1),
  KEYGEN_TOKEN: z.string().min(1),
  KEYGEN_HOST: z.string().url().default('https://api.keygen.sh'),
  KEYGEN_VERSION: z.string().default('1.8'),
})

export const env = envSchema.parse(process.env)
