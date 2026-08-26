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

export interface OrdinaryContact {
  phone?: string;
  email?: string;
  address?: string;
}

export interface CongregationPerson {
  id: PersonId;
  tenantId: TenantId;
  displayName: string;
  preferredLocale?: string;
  active: boolean;
  /** Stable identifiers from an explicitly linked external source; never contact data. */
  externalIds?: readonly string[];
  availability: readonly AvailabilityPeriod[];
  /** Append-only decision sequence. For equal decidedAt values, the later recorded entry wins. */
  eligibility: readonly EligibilityGrant[];
  /** Optional ordinary profile contact; separate from emergency contacts. */
  ordinaryContact?: OrdinaryContact;
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
 * Returns the current explicit decision from the persisted append-only sequence.
 * `decidedAt` remains the primary ordering fact. If two decisions share the same
 * timestamp, the later recorded array entry wins. Actor identifiers are audit
 * facts only and never carry business precedence.
 */
export function latestEligibilityDecision(
  decisions: readonly EligibilityGrant[],
  assignmentTypeId: AssignmentTypeId,
): EligibilityGrant | undefined {
  const normalized = assignmentTypeId.trim();
  if (!normalized) return undefined;
  let latest: EligibilityGrant | undefined;
  let latestAt = Number.NEGATIVE_INFINITY;
  for (const decision of decisions) {
    if (decision.assignmentTypeId !== normalized) continue;
    const decidedAt = parseInstant(decision.decidedAt);
    if (!latest || decidedAt >= latestAt) {
      latest = decision;
      latestAt = decidedAt;
    }
  }
  return latest;
}

/**
 * Eligibility is deliberately explicit. The domain layer never infers suitability
 * from gender, age, service history, attendance, comments, roles, AI output or any
 * other proxy. Authorized humans configure this value and the scheduler consumes it.
 */
export function isExplicitlyEligible(person: CongregationPerson, assignmentTypeId: AssignmentTypeId): boolean {
  return latestEligibilityDecision(person.eligibility, assignmentTypeId)?.enabled === true;
}

export function recordEligibilityDecision(
  person: CongregationPerson,
  input: EligibilityDecisionInput,
): CongregationPerson {
  parseInstant(input.decidedAt);
  const assignmentTypeId = input.assignmentTypeId.trim();
  if (!assignmentTypeId) throw new Error('assignmentTypeId is required');
  if (!input.decidedBy.trim()) throw new Error('decidedBy is required');

  return {
    ...person,
    eligibility: [...person.eligibility, { ...input, assignmentTypeId }],
  };
}

export function normalizeEmergencyContact(contact: EmergencyContact): EmergencyContact {
  const id = contact.id.trim();
  if (!id) throw new Error('emergencyContactId is required');
  const name = normalizeShortText(contact.name, 'emergencyContactName', 120);
  const phone = normalizeShortText(contact.phone, 'emergencyContactPhone', 40);
  const relationship = contact.relationship?.trim().replace(/\s+/g, ' ');
  if (relationship && relationship.length > 80) throw new Error('emergencyContactRelationship is too long');

  return {
    id,
    name,
    phone,
    ...(relationship ? { relationship } : {}),
  };
}

export function normalizeOrdinaryContact(contact: OrdinaryContact): OrdinaryContact {
  const phone = contact.phone?.trim().replace(/\s+/g, ' ');
  const email = contact.email?.trim();
  const address = contact.address?.trim().replace(/\s+/g, ' ');
  if (phone !== undefined && phone.length > 40) throw new Error('ordinaryContactPhone is too long');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('ordinaryContactEmail is invalid');
  if (address !== undefined && address.length > 500) throw new Error('ordinaryContactAddress is too long');
  return Object.freeze({ ...(phone ? { phone } : {}), ...(email ? { email } : {}), ...(address ? { address } : {}) });
}

export function ordinaryContactOf(person: CongregationPerson): OrdinaryContact {
  return Object.freeze({ ...(person.ordinaryContact?.phone ? { phone: person.ordinaryContact.phone } : {}), ...(person.ordinaryContact?.email ? { email: person.ordinaryContact.email } : {}), ...(person.ordinaryContact?.address ? { address: person.ordinaryContact.address } : {}) });
}

export function emergencyContactsOf(person: CongregationPerson): readonly EmergencyContact[] {
  return person.emergencyContacts ?? [];
}

export function assertTenantScope(person: CongregationPerson, tenantId: TenantId): void {
  if (person.tenantId !== tenantId) throw new Error('Cross-tenant person access denied');
}

export function normalizeDisplayName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) throw new Error('displayName is required');
  if (normalized.length > 120) throw new Error('displayName is too long');
  return normalized;
}
