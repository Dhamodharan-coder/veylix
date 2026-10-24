import { createAuthClient } from "better-auth/react";

// Same-origin by default, so no baseURL is needed.
export const authClient = createAuthClient();
