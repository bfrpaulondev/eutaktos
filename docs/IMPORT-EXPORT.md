# Import / Export Strategy

## Principle

Users must be able to leave Eutaktos with their data. Migration is a product capability, not a hostage mechanism.

## Clean-room interoperability

Third-party adapters will be implemented from:
- user-provided exports they are authorized to use;
- public documentation;
- documented common formats.

Eutaktos will not:
- copy proprietary source code;
- bypass encryption or access controls;
- scrape private accounts without explicit authorization and a lawful integration path;
- reproduce protected UI/assets merely to imitate another product.

## Hourglass

Public Hourglass documentation states that congregation data can be exported in PDF, DOCX, CSV or JSON, and NW Scheduler publicly documents importing a user-generated Hourglass congregation export.

Eutaktos target:
- accept a user-provided Hourglass export;
- detect supported format/version;
- parse into a canonical migration model;
- show preview and mapping;
- validate duplicates/conflicts;
- import selected scopes;
- produce a migration log;
- support rollback before finalization.

No importer will require disabling/bypassing encryption remotely. The user must provide a legitimate export they can access.

## New World Scheduler

Target documented/common pathways first:
- CSV;
- territory/address CSV;
- public-talk schedule CSV where documented;
- other export formats only after format/legal review.

## Canonical migration model

Adapters map into a versioned intermediate representation rather than writing directly to production tables. This prevents every external format from becoming part of the core data model.

## Required tests

Each adapter requires:
- anonymized/generative fixtures;
- malformed-file corpus;
- golden expected output;
- duplicate/conflict cases;
- large-file test;
- round-trip tests where meaningful;
- security tests for parser abuse;
- version-detection tests.

## Export formats

- JSON canonical export;
- CSV by domain;
- PDF reports;
- DOCX where useful;
- GeoJSON/KML for territory geometry;
- encrypted Eutaktos backup bundle.

Exports must be audited and must respect caller permissions.
