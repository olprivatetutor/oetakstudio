import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        birthDate: { type: "string", required: false, returned: false },
      },
    }),
    twoFactorClient(),
  ],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
} = authClient;
