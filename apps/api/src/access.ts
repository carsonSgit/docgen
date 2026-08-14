import { createRemoteJWKSet, jwtVerify } from "jose";

export type AccessIdentity = { email?: string; sub?: string };
export type AccessVerifier = (request: Request) => Promise<AccessIdentity>;

export function createAccessVerifier(
  teamDomain: string,
  audience: string,
): AccessVerifier {
  const issuer = teamDomain.replace(/\/$/, "");
  const keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));

  return async (request) => {
    const token = request.headers.get("CF-Access-Jwt-Assertion");
    if (!token) throw new Error("Cloudflare Access authentication required.");

    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience,
    });
    return {
      email: typeof payload.email === "string" ? payload.email : undefined,
      sub: payload.sub,
    };
  };
}
