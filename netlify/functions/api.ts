import { handleNetlifyApiEvent, type NetlifyApiEvent } from '../../api/_netlify';

export async function handler(event: NetlifyApiEvent) {
  return handleNetlifyApiEvent(event);
}
