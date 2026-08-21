// ─────────────────────────────────────────────────────────────────────────────
// K30 — Explicit Eligibility Constraint Adapter (fail-closed, no scoring/inference)
// ─────────────────────────────────────────────────────────────────────────────

// ── Public Types ──────────────────────────────────────────────────────────────

export interface EligibilityEntry {
  readonly personId: string;
  readonly tenantId: string;
  readonly assignmentTypeId: string;
  readonly enabled: boolean;
  readonly decidedBy: string;
  readonly decidedAt: string; // ISO 8601
}

export interface EligibilityConstraint {
  readonly personId: string;
  readonly assignmentTypeId: string;
  readonly eligible: boolean;
}

export interface EligibilityCheckResult {
  readonly personId: string;
  readonly assignmentTypeId: string;
  readonly eligible: boolean;
  readonly reason: 'explicit-grant' | 'explicit-denial' | 'no-eligibility-record';
}

// ── Internal Types ────────────────────────────────────────────────────────────

interface ResolvedEntry {
  readonly enabled: boolean;
  readonly decidedAt: string;
}

type EligibilityIndexKey = string;

/** Null character used as separator — cannot appear in normal user strings */
const SEP = '\0';

/**
 * A frozen, immutable lookup structure for eligibility checks.
 *
 * For each (personId, assignmentTypeId) pair it stores the most-recent
 * decision (by `decidedAt`).  The map is Object.frozen so callers cannot
 * accidentally mutate the index.
 */
export type EligibilityIndex = ReadonlyMap<EligibilityIndexKey, ResolvedEntry>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function indexKey(personId: string, assignmentTypeId: string): EligibilityIndexKey {
  return personId + SEP + assignmentTypeId;
}

function parseIndexKey(key: EligibilityIndexKey): { personId: string; assignmentTypeId: string } {
  const idx = key.indexOf(SEP);
  if (idx === -1) return { personId: key, assignmentTypeId: '' };
  return { personId: key.slice(0, idx), assignmentTypeId: key.slice(idx + 1) };
}

// ── Validation Errors ────────────────────────────────────────────────────────

const ERRORS = {
  PERSON_ID_REQUIRED: 'personId is required',
  PERSON_ID_TOO_LONG: 'personId exceeds maximum length of 200',
  TENANT_ID_REQUIRED: 'tenantId is required',
  TENANT_ID_TOO_LONG: 'tenantId exceeds maximum length of 200',
  ASSIGNMENT_TYPE_ID_REQUIRED: 'assignmentTypeId is required',
  ASSIGNMENT_TYPE_ID_TOO_LONG: 'assignmentTypeId exceeds maximum length of 200',
  DECIDED_BY_REQUIRED: 'decidedBy is required',
  DECIDED_BY_TOO_LONG: 'decidedBy exceeds maximum length of 200',
  DECIDED_AT_REQUIRED: 'decidedAt is required',
  DECIDED_AT_INVALID: 'decidedAt must be a valid ISO 8601 date',
} as const;

export type EligibilityValidationError = (typeof ERRORS)[keyof typeof ERRORS];

function requiredString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new Error(`${field} exceeds maximum length of ${maxLen}`);
  }
  return trimmed;
}

function validateIso8601(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
  const trimmed = value.trim();
  if (!Number.isFinite(Date.parse(trimmed))) {
    throw new Error(`${field} must be a valid ISO 8601 date`);
  }
  return trimmed;
}

// ── Public Functions ──────────────────────────────────────────────────────────

/**
 * Build a frozen lookup index from eligibility entries.
 *
 * When multiple entries exist for the same (personId, assignmentTypeId),
 * the entry with the most recent `decidedAt` wins.
 *
 * Returns an Object.frozen Map — callers cannot mutate it.
 */
export function buildEligibilityIndex(entries: readonly EligibilityEntry[]): EligibilityIndex {
  const map = new Map<EligibilityIndexKey, ResolvedEntry>();

  for (const entry of entries) {
    const key = indexKey(entry.personId, entry.assignmentTypeId);
    const existing = map.get(key);
    const entryTime = Date.parse(entry.decidedAt);

    if (!existing || entryTime > Date.parse(existing.decidedAt)) {
      map.set(key, Object.freeze({ enabled: entry.enabled, decidedAt: entry.decidedAt }));
    }
  }

  return Object.freeze(map);
}

/**
 * Check if a person is eligible for a specific assignment type.
 *
 * **Fail-closed**: if there is no record, the person is NOT eligible.
 */
export function checkEligibility(
  index: EligibilityIndex,
  personId: string,
  assignmentTypeId: string,
): EligibilityCheckResult {
  const key = indexKey(personId, assignmentTypeId);
  const entry = index.get(key);

  if (!entry) {
    return Object.freeze({
      personId,
      assignmentTypeId,
      eligible: false,
      reason: 'no-eligibility-record' as const,
    });
  }

  return Object.freeze({
    personId,
    assignmentTypeId,
    eligible: entry.enabled,
    reason: entry.enabled ? ('explicit-grant' as const) : ('explicit-denial' as const),
  });
}

/**
 * Check multiple persons for one assignment type.
 */
export function checkEligibilityBatch(
  index: EligibilityIndex,
  personIds: readonly string[],
  assignmentTypeId: string,
): readonly EligibilityCheckResult[] {
  return Object.freeze(
    personIds.map((pid) => checkEligibility(index, pid, assignmentTypeId)),
  );
}

/**
 * Return only the person IDs that are explicitly eligible.
 */
export function filterEligiblePersons(
  index: EligibilityIndex,
  personIds: readonly string[],
  assignmentTypeId: string,
): readonly string[] {
  return Object.freeze(
    personIds.filter((pid) => checkEligibility(index, pid, assignmentTypeId).eligible),
  );
}

/**
 * Return all assignment types a person is explicitly eligible for.
 */
export function getEligibleAssignmentTypes(
  index: EligibilityIndex,
  personId: string,
): readonly string[] {
  const prefix = personId + SEP;
  const results: string[] = [];

  for (const [key, entry] of index) {
    if (key.startsWith(prefix) && entry.enabled) {
      results.push(parseIndexKey(key).assignmentTypeId);
    }
  }

  return Object.freeze(results);
}

/**
 * Validate a single eligibility entry.
 *
 * Returns the entry on success (frozen, trimmed).
 * Throws `Error` with a descriptive message on failure.
 */
export function validateEligibilityEntry(entry: unknown): EligibilityEntry {
  if (entry === null || entry === undefined || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('entry must be a non-null object');
  }
  const e = entry as Record<string, unknown>;

  const personId = requiredString(e.personId, 'personId', 200);
  const tenantId = requiredString(e.tenantId, 'tenantId', 200);
  const assignmentTypeId = requiredString(e.assignmentTypeId, 'assignmentTypeId', 200);
  const decidedBy = requiredString(e.decidedBy, 'decidedBy', 200);
  const decidedAt = validateIso8601(e.decidedAt, 'decidedAt');

  const enabled = e.enabled;
  if (typeof enabled !== 'boolean') {
    throw new Error('enabled must be a boolean');
  }

  return Object.freeze({
    personId,
    tenantId,
    assignmentTypeId,
    enabled,
    decidedBy,
    decidedAt,
  });
}

/**
 * Filter eligibility entries to a single tenant.
 */
export function filterEntriesByTenant(
  entries: readonly EligibilityEntry[],
  tenantId: string,
): readonly EligibilityEntry[] {
  return Object.freeze(entries.filter((e) => e.tenantId === tenantId));
}

/**
 * Convert eligibility entries to constraint format.
 *
 * When there are duplicates (same personId + assignmentTypeId), the
 * most-recent decision wins — matching the index behaviour.
 */
export function entriesToConstraints(entries: readonly EligibilityEntry[]): readonly EligibilityConstraint[] {
  const index = buildEligibilityIndex(entries);
  const constraints: EligibilityConstraint[] = [];

  for (const [key, entry] of index) {
    const { personId, assignmentTypeId } = parseIndexKey(key);
    constraints.push(
      Object.freeze({
        personId,
        assignmentTypeId,
        eligible: entry.enabled,
      }),
    );
  }

  return Object.freeze(constraints);
}
