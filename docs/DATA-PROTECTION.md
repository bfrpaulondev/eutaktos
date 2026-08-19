# Data Protection Plan

This document is an engineering plan, not legal advice. Formal review by qualified EU/Portuguese privacy counsel is a pre-production requirement.

## Why the risk level is high

Eutaktos can process data that reveals religious beliefs/affiliation. GDPR Article 9 treats data revealing religious or philosophical beliefs as a special category of personal data.

Reference: Regulation (EU) 2016/679, Article 9:
https://eur-lex.europa.eu/legal-content/PT-EN/TXT/?uri=CELEX:32016R0679

## Intended roles

The initial legal/technical model to validate with counsel:
- each congregation/appropriate religious entity determines purposes, people, permissions and operational use;
- Eutaktos acts primarily as processor/service provider under documented instructions;
- a Data Processing Agreement and subprocessor list are required;
- data-processing purpose and legal basis remain the responsibility of the appropriate controller.

## Privacy-by-design requirements

- data minimization;
- purpose limitation;
- tenant isolation;
- privacy-protective defaults;
- retention rules by data class;
- self-service export/deletion workflows where legally applicable;
- no advertising identifiers;
- no sale of data;
- no cross-congregation analytics using identifiable people;
- no AI training on congregation content by Eutaktos;
- production support access must be exceptional, time-limited and auditable.

## DPIA

A Data Protection Impact Assessment is a release prerequisite. It must cover:
- special-category data;
- scale and geographic scope;
- minors/dependents where present;
- AI decision-support;
- WhatsApp/email/push subprocessors;
- map/location data;
- restricted committee notes;
- exports/backups;
- incident scenarios.

## Data residency and transfers

EU-region infrastructure is the default target for EU congregations. Any international transfer requires documented legal review, transfer mechanism and subprocessor assessment.

## Incident response

The incident process must identify controller/processor responsibilities and support the GDPR breach-notification timeline. Article 33 provides that a controller may need to notify the competent supervisory authority without undue delay and, where feasible, within 72 hours after becoming aware, unless the breach is unlikely to result in risk; processors must notify controllers without undue delay.

## DPO / privacy governance

As Eutaktos grows, large-scale processing of special-category data can trigger DPO obligations. This is a Phase 0/ongoing legal-governance question, not something to decide after scaling.

Portuguese authority reference:
https://www.cnpd.pt/organizacoes/outras-obrigacoes/encarregado-de-protecao-de-dados/

## AI transparency

Users must clearly know when they are interacting with an AI assistant. EU AI Act transparency obligations are included in the compliance checklist.

Reference:
https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32024R1689
