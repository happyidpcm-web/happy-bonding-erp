import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  JWT_SECRET: z.string().min(32),
  API_PORT: z.coerce.number().int().positive().default(4000),
});

export const env = schema.parse(process.env);
