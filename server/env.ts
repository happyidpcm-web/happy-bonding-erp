import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8).default("HappyBonding@2026SuperSecretKeyForERPDefault!"),
  API_PORT: z.coerce.number().int().positive().default(4000),
});

export const env = schema.parse(process.env);
