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
    };
  }

  interface User {
    tenantId: string;
    tenantSlug: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId: string;
    tenantSlug: string;
    role: Role;
  }
}
