import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function signHaircutRatingToken(haircutId: string): string {
  return signToken("haircut-rate", haircutId, TOKEN_TTL.haircutRate);
}

export function verifyHaircutRatingToken(token: string): string | null {
  return verifyToken("haircut-rate", token);
}

export function buildHaircutRatingUrl(haircutId: string): string {
  return `${APP_URL}/foto/${signHaircutRatingToken(haircutId)}`;
}
