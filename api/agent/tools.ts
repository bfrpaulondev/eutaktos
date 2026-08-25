import { createAccessContext } from '@eutaktos/domain';
import { AvailabilityService, PeopleDirectoryService } from '@eutaktos/application';
import type { VerifiedPrincipal } from '../_auth';
import type { SupabaseRestDatabase } from '../_db';
import { PeopleSnapshotUnitOfWork, RuntimeIds } from '../_uow';
import { approvedHelp } from './policy';
import { AgentToolDeniedError, AgentToolError, type AgentEvidence } from './contracts';

export interface AgentToolContext {
  readonly principal: VerifiedPrincipal;
  readonly database: SupabaseRestDatabase;
  readonly now: () => string;
}

export interface AgentToolResult {
  readonly output: Readonly<Record<string, unknown>>;
  readonly evidence: readonly AgentEvidence[];
}

export interface AgentTool {
  readonly name: string;
  readonly schema: Readonly<Record<string, unknown>>;
  execute(context: AgentToolContext, rawArguments: string): Promise<AgentToolResult>;
}

function asObject(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AgentToolError('Invalid tool arguments');
  return value as Readonly<Record<string, unknown>>;
}

function parseArguments(rawArguments: string, allowed: readonly string[]): Readonly<Record<string, unknown>> {
  let value: unknown;
  try { value = JSON.parse(rawArguments); } catch { throw new AgentToolError('Invalid tool arguments'); }
  const body = asObject(value);
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new AgentToolError('Invalid tool arguments');
  return body;
}

function optionalSearch(body: Readonly<Record<string, unknown>>, name: string): string | undefined {
  if (body[name] === undefined) return undefined;
  if (typeof body[name] !== 'string') throw new AgentToolError('Invalid tool arguments');
  const value = body[name].trim();
  if (!value || value.length > 120) throw new AgentToolError('Invalid tool arguments');
  return value;
}

function boundedLimit(body: Readonly<Record<string, unknown>>, fallback = 12): number {
  if (body.limit === undefined) return fallback;
  if (!Number.isInteger(body.limit) || (body.limit as number) < 1 || (body.limit as number) > 25) throw new AgentToolError('Invalid tool arguments');
  return body.limit as number;
}

function boundedInstant(body: Readonly<Record<string, unknown>>, name: string, fallback: string): string {
  if (body[name] === undefined) return fallback;
  if (typeof body[name] !== 'string' || !Number.isFinite(Date.parse(body[name] as string))) throw new AgentToolError('Invalid tool arguments');
  return body[name] as string;
}

function accessContext(principal: VerifiedPrincipal) {
  return createAccessContext({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    capabilities: principal.capabilities,
  });
}

async function peopleServices(context: AgentToolContext) {
  const rows = await context.database.entities(context.principal.tenantId, 'person');
  const unitOfWork = new PeopleSnapshotUnitOfWork(context.principal.tenantId, rows);
  const runtime = new RuntimeIds();
  return Object.freeze({
    people: new PeopleDirectoryService(unitOfWork, runtime),
    availability: new AvailabilityService(unitOfWork, runtime),
    access: accessContext(context.principal),
  });
}

function deniedFrom(error: unknown): never {
  if (error instanceof AgentToolError) throw error;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Access denied') || message.includes('Cross-tenant')) throw new AgentToolDeniedError('Tool access denied');
  throw new AgentToolError('Tool failed');
}

const peopleSummarySchema = Object.freeze({
  type: 'function',
  name: 'get_people_summary',
  description: 'Get a minimal, tenant-scoped summary of people matching an optional name query. Use only when current people facts are needed.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string', description: 'Optional name fragment, maximum 120 characters.' },
      limit: { type: 'integer', minimum: 1, maximum: 25 },
    },
  },
});

const availabilitySummarySchema = Object.freeze({
  type: 'function',
  name: 'get_availability_summary',
  description: 'Get a minimal, tenant-scoped summary of explicit unavailable periods. Use only when availability facts are needed.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      from: { type: 'string', description: 'Optional ISO instant. Defaults to now.' },
      until: { type: 'string', description: 'Optional ISO instant. Defaults to 30 days from now.' },
      limit: { type: 'integer', minimum: 1, maximum: 25 },
    },
  },
});

const helpSchema = Object.freeze({
  type: 'function',
  name: 'get_application_help',
  description: 'Get approved static Eutaktos help about general use, assignments or availability. It does not access tenant data.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: { topic: { type: 'string', enum: ['general', 'assignments', 'availability'] } },
  },
});

export function createAgentTools(): readonly AgentTool[] {
  const people: AgentTool = {
    name: 'get_people_summary',
    schema: peopleSummarySchema,
    async execute(context, rawArguments) {
      try {
        const body = parseArguments(rawArguments, ['query', 'limit']);
        const query = optionalSearch(body, 'query')?.toLocaleLowerCase();
        const limit = boundedLimit(body);
        const services = await peopleServices(context);
        const matching = services.people.list(services.access)
          .filter(person => !query || person.displayName.toLocaleLowerCase().includes(query))
          .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id));
        const entries = matching.slice(0, limit).map(person => Object.freeze({
          personId: person.id,
          displayName: person.displayName,
          active: person.active,
          explicitUnavailablePeriodCount: person.availability.length,
        }));
        return Object.freeze({
          output: Object.freeze({ totalMatchingPeople: matching.length, people: Object.freeze(entries) }),
          evidence: Object.freeze([{ source: 'get_people_summary', label: 'People directory (tenant-scoped)' }]),
        });
      } catch (error) { return deniedFrom(error); }
    },
  };

  const availability: AgentTool = {
    name: 'get_availability_summary',
    schema: availabilitySummarySchema,
    async execute(context, rawArguments) {
      try {
        const body = parseArguments(rawArguments, ['from', 'until', 'limit']);
        const from = boundedInstant(body, 'from', context.now());
        const until = boundedInstant(body, 'until', new Date(Date.parse(from) + 30 * 24 * 60 * 60 * 1000).toISOString());
        if (Date.parse(until) <= Date.parse(from)) throw new AgentToolError('Invalid tool arguments');
        const limit = boundedLimit(body);
        const services = await peopleServices(context);
        const entries = services.people.list(services.access)
          .flatMap(person => services.availability.list(services.access, person.id)
            .filter(period => Date.parse(period.endsAt) >= Date.parse(from) && Date.parse(period.startsAt) <= Date.parse(until))
            .map(period => Object.freeze({ personId: person.id, displayName: person.displayName, startsAt: period.startsAt, endsAt: period.endsAt, reasonCode: period.reasonCode ?? 'unspecified' })))
          .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.personId.localeCompare(right.personId))
          .slice(0, limit);
        return Object.freeze({
          output: Object.freeze({ from, until, unavailablePeriods: Object.freeze(entries) }),
          evidence: Object.freeze([{ source: 'get_availability_summary', label: 'Explicit availability periods (tenant-scoped)' }]),
        });
      } catch (error) { return deniedFrom(error); }
    },
  };

  const help: AgentTool = {
    name: 'get_application_help',
    schema: helpSchema,
    async execute(_context, rawArguments) {
      const body = parseArguments(rawArguments, ['topic']);
      const topic = optionalSearch(body, 'topic');
      return Object.freeze({
        output: Object.freeze({ topic: topic ?? 'general', content: approvedHelp(topic) }),
        evidence: Object.freeze([{ source: 'get_application_help', label: 'Approved Eutaktos help' }]),
      });
    },
  };

  return Object.freeze([people, availability, help]);
}
