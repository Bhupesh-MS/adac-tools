# @mindfiredigital/adac-validator

Schema validator for ADAC (Architecture Diagram As Code) definitions.

## Features

- Validates ADAC configuration objects against the shared schema.
- Returns structured validation results.
- Supports ESM and TypeScript.

## Usage

```typescript
import { validateAdacConfig } from '@mindfiredigital/adac-validator';

const result = validateAdacConfig(config);

if (!result.valid) {
  console.error(result.errors);
}
```
