import { AuthenticationError } from '../_auth';
import { BadRequestError, assertTrustedMutation, exactKeys, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { SupabaseIdentityBridge } from '../_identity-auth';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

function emailFromBody(value: unknown): string {
  const body = requestBody(value);
  exactKeys(body, ['email']);
  const email = requiredString(body, 'email', 254).toLowerCase();
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@') || /\s/.test(email)) throw new BadRequestError('Invalid email');
  return email;
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async () => {
    assertTrustedMutation(request);
    const email = emailFromBody(request.body);
    const bridge = new SupabaseIdentityBridge();
    const identity = await bridge.identityForEmail(email);
    if (identity) {
      try { await bridge.requestEmailOtp(email, identity.authUserId === undefined); }
      catch (error) {
        if (!(error instanceof AuthenticationError)) throw error;
      }
    }
    response.setHeader('Cache-Control', 'no-store');
    json(response, 202, { status: 'check-email' });
  });
};

export default handler;
