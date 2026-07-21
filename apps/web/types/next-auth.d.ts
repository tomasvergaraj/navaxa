import type { Role } from "@navaxa/db";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string;
      tenantSlug: string;
      role: Role;
      platformAdmin: boolean;
    };
  }

  interface User {
    tenantId: string;
    tenantSlug: string;
    role: Role;
    platformAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId: string;
    tenantSlug: string;
    role: Role;
    platformAdmin: boolean;
    /** Instante de emisión (ms epoch) para la revocación por sessionInvalidBefore. */
    authAt?: number;
  }
}
