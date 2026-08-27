import { HOURGLASS_IMPORT_LIMITS, inspectHourglassJsonExport, type HourglassImportInspection } from '@eutaktos/application';
import { BadRequestError } from '../../_endpoint';

export const HOURGLASS_REQUEST_MAX_BODY_BYTES = HOURGLASS_IMPORT_LIMITS.maxJsonBytes + 2048;

export function inspectHourglassRequestPayload(
  source: unknown,
  payload: unknown,
): Readonly<HourglassImportInspection> {
  if (source !== 'json') throw new BadRequestError('Only the proven Hourglass JSON source supports reconciliation');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequestError('Hourglass JSON payload is required');
  const serialized = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  try {
    return inspectHourglassJsonExport(payload, bytes);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : 'Invalid Hourglass JSON payload');
  }
}
