export type TenantId = string;
export type PersonId = string;
export type AssignmentTypeId = string;
export type AvailabilityPeriodId = string;
export type EmergencyContactId = string;

export interface AvailabilityPeriod {
  /**
   * Legacy/imported periods may temporarily omit an id. New application writes
   * always create a stable identifier so edits/deletions do not rely on dates.
   */
  id?: AvailabilityPeriodId;
  startsAt: string;
  endsAt: string;
  reasonCode?: 'away' | 'unavailable' | 'other';
}

export interface EligibilityGrant {
  assignmentTypeId: AssignmentTypeId;
  enabled: boolean;
  decidedBy: PersonId;
  decidedAt: string;
}

export interface EmergencyContact {
  id: EmergencyContactId;
  name: string;
  phone: string;
  relationship?: string;
}

export interface PersonPostalAddress {
  line1?: string;
  line2?: string;
  postalCode?: string;
  locality?: string;
  countryCode?: string;
}

export interface PersonContactDetails {
  phone?: string;
  email?: string;
  address?: Readonly<PersonPostalAddress>;
}

export interface CongregationPerson {
  id: PersonId;
  tenantId: TenantId;
  displayName: string;
  preferredLocale?: string;
  active: boolean;
  /** Ordinary contact data; never serialized by directory/list projections. */
  contact?: Readonly<PersonContactDetails>;
  /** Stable identifiers from an explicitly linked external source; never contact data. */
  externalIds?: readonly string[];
  availability: readonly AvailabilityPeriod[];
  eligibility: readonly EligibilityGrant[];
  /** Legacy/imported records may omit this until normalized by an application write. */
  emergencyContacts?: readonly EmergencyContact[];
}

export interface EligibilityDecisionInput {
  assignmentTypeId: AssignmentTypeId;
  enabled: boolean;
  decidedBy: PersonId;
  decidedAt: string;
}

function parseInstant(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ISO date: ${value}`);
  return timestamp;
}

function normalizeShortText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
}

function optionalText(value: string | undefined, field: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().replace(/[\t ]+/g, ' ');
  if (!normalized) return undefined;
  if (/[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${field} contains control characters`);
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
}

export function normalizePersonContactDetails(input: PersonContactDetails | undefined | null): Readonly<PersonContactDetails> | undefined {
  if (!input) return undefined;
  const phone = optionalText(input.phone, 'contactPhone', 40);
  const rawEmail = optionalText(input.email, 'contactEmail', 254);
  const email = rawEmail?.toLocaleLowerCase('en-US');
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes('..'))) throw new Error('contactEmail must be a valid email address');

  const rawAddress = input.address;
  const line1 = optionalText(rawAddress?.line1, 'contactAddressLine1', 160);
  const line2 = optionalText(rawAddress?.line2, 'contactAddressLine2', 160);
  const postalCode = optionalText(rawAddress?.postalCode, 'contactPostalCode', 24);
  const locality = optionalText(rawAddress?.locality, 'contactLocality', 100);
  const rawCountry = optionalText(rawAddress?.countryCode, 'contactCountryCode', 2);
  const countryCode = rawCountry?.toLocaleUpperCase('en-US');
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) throw new Error('contactCountryCode must be a two-letter country code');

  const address = line1 || line2 || postalCode || locality || countryCode
    ? Object.freeze({ ...(line1 ? { line1 } : {}), ...(line2 ? { line2 } : {}), ...(postalCode ? { postalCode } : {}), ...(locality ? { locality } : {}), ...(countryCode ? { countryCode } : {}) })
    : undefined;
  if (!phone && !email && !address) return undefined;
  return Object.freeze({ ...(phone ? { phone } : {}), ...(email ? { email } : {}), ...(address ? { address } : {}) });
}

export function validateAvailability(period: AvailabilityPeriod): AvailabilityPeriod {
  const startsAt = parseInstant(period.startsAt);
  const endsAt = parseInstant(period.endsAt);
  if (endsAt <= startsAt) throw new Error('Availability period must end after it starts');
  if (period.id !== undefined && !period.id.trim()) throw new Error('availabilityPeriodId is required when provided');
  return period;
}

export function isPersonAvailableAt(person: CongregationPerson, instant: string): boolean {
  if (!person.active) return false;
  const target = parseInstant(instant);
  return !person.availability.some(period => {
    validateAvailability(period);
    return target >= parseInstant(period.startsAt) && target < parseInstant(period.endsAt);
  });
}

/**
 * Eligibility is deliberately explicit. The domain layer never infers suitability
 * from gender, age, service history, attendance, comments, roles, AI output or any
 * other proxy. Authorized humans configure this value and the scheduler consumes it.
 */
export function isExplicitlyEligible(person: CongregationPerson, assignmentTypeId: AssignmentTypeId): boolean {
  const latest = [...person.eligibility]
    .filter(grant => grant.assignmentTypeId === assignmentTypeId)
    .sort((left, right) => parseInstant(right.decidedAt) - parseInstant(left.decidedAt))[0];
  return latest?.enabled === true;
}

export function recordEligibilityDecision(person: CongregationPerson, input: EligibilityDecisionInput): CongregationPerson {
  parseInstant(input.decidedAt);
  const assignmentTypeId = input.assignmentTypeId.trim();
  if (!assignmentTypeId) throw new Error('assignmentTypeId is required');
  if (!input.decidedBy.trim()) throw new Error('decidedBy is required');
  return { ...person, eligibility: [...person.eligibility, { ...input, assignmentTypeId }] };
}

export function normalizeEmergencyContact(contact: EmergencyContact): EmergencyContact {
  const id = contact.id.trim();
  if (!id) throw new Error('emergencyContactId is required');
  const name = normalizeShortText(contact.name, 'emergencyContactName', 120);
  const phone = normalizeShortText(contact.phone, 'emergencyContactPhone', 40);
  const relationship = contact.relationship?.trim().replace(/\s+/g, ' ');
  if (relationship && relationship.length > 80) throw new Error('emergencyContactRelationship is too long');
  return { id, name, phone, ...(relationship ? { relationship } : {}) };
}

export function emergencyContactsOf(person: CongregationPerson): readonly EmergencyContact[] { return person.emergencyContacts ?? []; }
export function assertTenantScope(person: CongregationPerson, tenantId: TenantId): void { if (person.tenantId !== tenantId) throw new Error('Cross-tenant person access denied'); }
export function normalizeDisplayName(value: string): string { const normalized = value.trim().replace(/\s+/g, ' '); if (normalized.length < 2) throw new Error('displayName is required'); if (normalized.length > 120) throw new Error('displayName is too long'); return normalized; }
