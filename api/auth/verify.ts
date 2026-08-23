import { AuthenticationError, sessionCookie } from '../_auth';
import { BadRequestError, assertTrustedMutation, exactKeys, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { SupabaseIdentityBridge, type SupabaseOtpSession } from '../_identity-auth';
import { consumeTemporaryPilotAccessCode } from '../_pilot-access';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

type VerifyInput =
  | Readonly<{ kind: 'otp'; email: string; token: string }>
  | Readonly<{ kind: 'magic-link'; accessToken: string }>
  | Readonly<{ kind: 'magic-link-token-hash'; tokenHash: string }>;

function inputFromBody(value: unknown): VerifyInput {
  const body = requestBody(value);
  if (body.accessToken !== undefined) {
    exactKeys(body, ['accessToken']);
    const accessToken = requiredString(body, 'accessToken', 8192);
    if (accessToken.split('.').length !== 3) throw new BadRequestError('Invalid authentication token');
    return Object.freeze({ kind: 'magic-link' as const, accessToken });
  }
  if (body.tokenHash !== undefined) {
    exactKeys(body, ['tokenHash']);
    const tokenHash = requiredString(body, 'tokenHash', 512);
    if (tokenHash.length < 32 || !/^[A-Za-z0-9_-]+$/.test(tokenHash)) throw new BadRequestError('Invalid authentication link');
    return Object.freeze({ kind: 'magic-link-token-hash' as const, tokenHash });
  }

  exactKeys(body, ['email', 'token']);
  const email = requiredString(body, 'email', 254).toLowerCase();
  const token = requiredString(body, 'token', 12);
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@') || /\s/.test(email)) throw new BadRequestError('Invalid email');
  if (!/^\d{6}$/.test(token)) throw new BadRequestError('Invalid authentication code');
  return Object.freeze({ kind: 'otp' as const, email, token });
}

async function verifyIdentity(bridge: SupabaseIdentityBridge, input: VerifyInput): Promise<SupabaseOtpSession> {
  if (input.kind === 'magic-link') return bridge.verifyAccessToken(input.accessToken);
  if (input.kind === 'magic-link-token-hash') return bridge.verifyEmailTokenHash(input.tokenHash);
  const identity = await bridge.identityForEmail(input.email);
  if (!identity) throw new AuthenticationError('Identity not authorized');
  const verified = await bridge.verifyEmailOtp(input.email, input.token);
  if (identity.authUserId && identity.authUserId !== verified.authUserId) throw new AuthenticationError('Identity mismatch');
  return verified;
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const input = inputFromBody(request.body);
    const bridge = new SupabaseIdentityBridge();
    const sessionId = `session-${crypto.randomUUID()}`;
    const authenticatedAt = new Date().toISOString();

    if (input.kind === 'otp') {
      const pilotSession = await consumeTemporaryPilotAccessCode({
        email: input.email,
        code: input.token,
        sessionId,
        authenticatedAt,
      });
      if (pilotSession) {
        const grants = await database.activeGrants(pilotSession.tenantId, pilotSession.actorId);
        const capabilities = [...new Set(grants.map(grant => grant.capability))].sort();
        response.setHeader('Set-Cookie', sessionCookie(pilotSession.sessionId));
        response.setHeader('Cache-Control', 'no-store');
        json(response, 200, { actorId: pilotSession.actorId, capabilities });
        return;
      }
    }

    const verified = await verifyIdentity(bridge, input);
    const identity = await bridge.identityForEmail(verified.email);
    if (!identity) throw new AuthenticationError('Identity not authorized');
    if (identity.authUserId && identity.authUserId !== verified.authUserId) throw new AuthenticationError('Identity mismatch');

    const created = await bridge.createEutaktosSession({
      email: verified.email,
      authUserId: verified.authUserId,
      sessionId,
      authenticatedAt,
      aal: verified.aal,
    });
    const grants = await database.activeGrants(created.tenantId, created.actorId);
    const capabilities = [...new Set(grants.map(grant => grant.capability))].sort();

    response.setHeader('Set-Cookie', sessionCookie(created.sessionId));
    response.setHeader('Cache-Control', 'no-store');
    json(response, 200, { actorId: created.actorId, capabilities });
  });
};

export default handler;
