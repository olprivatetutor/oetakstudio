import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as authSchema from "@/db/schema/auth";
import * as learningSchema from "@/db/schema/learning";
import * as workspaceSchema from "@/db/schema/workspace";

export const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    ...authSchema,
    ...learningSchema,
    ...workspaceSchema,
  },
});
