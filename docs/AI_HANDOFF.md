# AI HANDOFF

## Estado atual
O projeto está na Fase 1 (Engineering Foundation), com o domínio core e serviços de aplicação parcialmente implementados. Os pacotes `domain`, `application`, `infrastructure` e `transport` estão ativos e funcionando.

## Última tarefa implementada
Adicionado `OrganizationService` em `packages/application/` com use cases completos para Households, Service Groups e Responsibility Assignments. O domínio de organização já existia em `packages/domain/organization.ts`; esta tarefa adicionou a camada de aplicação (coordenação de UoW, capabilities, audit events, domain events, validações de tenant).

## Branch
`kimi/organization-service`

## Arquivos alterados
- `packages/application/src/organization-service.ts` (novo) — serviço completo com 3 UoW interfaces + 11 métodos de use case
- `packages/application/src/organization-service.test.ts` (novo) — 29 testes cobrindo happy path, edge cases, capabilities, tenant isolation
- `packages/application/src/index.ts` (modificado) — adicionada exportação do novo serviço

## Testes executados
- typecheck: PASS (todos os 5 workspaces)
- unit tests: PASS (87 testes: 38 domain + 21 application + 4 infrastructure + 16 transport + PWA check)
- build: PASS
- audit: PASS (0 vulnerabilities)

## Decisões técnicas
- Seguido exatamente o padrão de `PeopleDirectoryService` / `EmergencyContactService`: UoW interfaces separadas, fake UoW nos testes, `ApplicationRuntime` compartilhado, `eventCorrelation` reutilizado.
- Household e ServiceGroup usam as capabilities `people.read`/`people.write` (mesmo padrão de acesso do diretório de pessoas). Responsibility usa `responsibilities.read`/`responsibilities.write` que já existem no `access-control.ts`.
- Os domain events para household/service group usam tipos genéricos (`PersonCreated`/`PersonUpdated`) como placeholder. Quando os eventos específicos do domínio de organização forem adicionados ao `DomainEventType` no `domain-events.ts`, devem ser atualizados aqui.
- `deleteHousehold` e `deleteServiceGroup` criam audit+domain events mas não os passam para o UoW (o UoW de delete retorna apenas boolean). O adapter de produção deve persistir esses eventos separadamente.

## Riscos ou pendências
- Os domain events para Household/ServiceGroup não têm tipos específicos ainda em `DomainEventType` — usam `PersonCreated`/`PersonUpdated` como placeholder temporário.
- `deleteHousehold` e `deleteServiceGroup` geram audit+domain events mas o UoW de delete só retorna boolean; adaptadores de produção precisarão coordenar a persistência dos eventos.
- Não existe ainda um adapter de infraestrutura para Household/ServiceGroup/Responsibility (como existe `people-memory.ts` para People).

## Próxima tarefa segura sugerida
Adicionar tipos de domain events específicos para organização em `packages/domain/src/domain-events.ts` (`HouseholdCreated`, `HouseholdUpdated`, `ServiceGroupCreated`, `ServiceGroupUpdated`, `ResponsibilityChanged` já existe). Alternativa: criar `organization-memory.ts` em `packages/infrastructure/` com adapters InMemory para Household/ServiceGroup/Responsibility.