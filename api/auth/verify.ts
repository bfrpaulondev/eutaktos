import { AuthenticationError, sessionCookie } from '../_auth';
import { BadRequestError, assertTrustedMutation, exactKeys, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { SupabaseIdentityBridge } from '../_identity-auth';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

function inputFromBody(value: unknown): { readonly email: string; readonly token: string } {
  const body = requestBody(value);
  exactKeys(body, ['email', 'token']);
  const email = requiredString(body, 'email', 254).toLowerCase();
  const token = requiredString(body, 'token', 12);
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@') || /\s/.test(email)) throw new BadRequestError('Invalid email');
  if (!/^\d{6}$/.test(token)) throw new BadRequestError('Invalid authentication code');
  return Object.freeze({ email, token });
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const { email, token } = inputFromBody(request.body);
    const bridge = new SupabaseIdentityBridge();
    const identity = await bridge.identityForEmail(email);
    if (!identity) throw new AuthenticationError('Identity not authorized');

    const verified = await bridge.verifyEmailOtp(email, token);
    if (identity.authUserId && identity.authUserId !== verified.authUserId) throw new AuthenticationError('Identity mismatch');

    const created = await bridge.createEutaktosSession({
      email,
      authUserId: verified.authUserId,
      sessionId: `session-${crypto.randomUUID()}`,
      authenticatedAt: new Date().toISOString(),
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
