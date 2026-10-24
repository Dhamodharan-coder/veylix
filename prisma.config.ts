// Prisma CLI config (migrations, db url). Loads .env via dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations should use Neon's direct (non-pooled) connection.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
