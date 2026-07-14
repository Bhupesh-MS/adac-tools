import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './adac.schema.json' with { type: 'json' };
import { AdacConfig } from './types.js';

type JsonSchema = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */
const AjvConstructor = Ajv as unknown as {
  new (options?: Record<string, unknown>): any;
};
const addFormatsFunc = addFormats as unknown as (a: any) => void;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ValidationExtension {
  name: string;
  rootProperties?: Record<string, JsonSchema>;
  awsServiceProperties?: Record<string, JsonSchema>;
  gcpServiceProperties?: Record<string, JsonSchema>;
  validate?: (config: unknown) => string[];
}

export interface ValidationOptions {
  extensions?: ValidationExtension[];
}

function createAjv() {
  const ajv = new AjvConstructor({ allErrors: true, strict: false });
  addFormatsFunc(ajv);
  return ajv;
}

function cloneSchema(): JsonSchema {
  return JSON.parse(JSON.stringify(schema)) as JsonSchema;
}

function getSchemaObject(source: JsonSchema, path: string[]): JsonSchema {
  let current = source;

  for (const segment of path) {
    const value = current[segment];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Invalid ADAC schema path: ${path.join('.')}`);
    }
    current = value as JsonSchema;
  }

  return current;
}

function extendProperties(
  target: JsonSchema,
  properties: Record<string, JsonSchema> | undefined
) {
  if (!properties) {
    return;
  }

  const existingProperties =
    (target.properties as Record<string, JsonSchema> | undefined) ?? {};

  for (const key of Object.keys(properties)) {
    if (key in existingProperties) {
      throw new Error(
        `Extension cannot override core ADAC schema property: ${key}`
      );
    }
  }

  target.properties = {
    ...existingProperties,
    ...properties,
  };
}

function buildValidator(extensions: ValidationExtension[] = []) {
  const schemaToCompile = cloneSchema();
  const defs = getSchemaObject(schemaToCompile, ['$defs']);
  const awsService = getSchemaObject(defs, ['aws_service']);
  const gcpService = getSchemaObject(defs, ['gcp_service']);

  for (const extension of extensions) {
    extendProperties(schemaToCompile, extension.rootProperties);
    extendProperties(awsService, extension.awsServiceProperties);
    extendProperties(gcpService, extension.gcpServiceProperties);
  }

  return createAjv().compile(schemaToCompile);
}

const baseValidate = buildValidator();

export function validateAdacConfig(
  config: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const validate =
    options.extensions && options.extensions.length > 0
      ? buildValidator(options.extensions)
      : baseValidate;
  const valid = validate(config);

  const errors: string[] = [];

  if (!valid) {
    const ajvErrors = (validate.errors || []) as {
      instancePath: string;
      message?: string;
      keyword?: string;
      params?: Record<string, unknown>;
    }[];

    // Ignore legacy 'cost' fields when validating without the cost extension
    const filteredErrors = ajvErrors.filter(
      (err) =>
        !(
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'cost'
        )
    );

    if (filteredErrors.length > 0) {
      errors.push(
        ...filteredErrors.map(
          (err) => `${err.instancePath} ${err.message || 'Invalid value'}`
        )
      );
    }
  }

  // Ensure instance IDs are unique across the entire configuration
  if (config && typeof config === 'object') {
    const typedConfig = config as AdacConfig;
    const allIds = new Set<string>();

    const checkId = (id: string | undefined, path: string) => {
      if (id) {
        if (allIds.has(id)) {
          errors.push(`${path} ID "${id}" is not unique`);
        }
        allIds.add(id);
      }
    };

    if (Array.isArray(typedConfig.applications)) {
      typedConfig.applications.forEach((app, index) => {
        checkId(app?.id, `/applications/${index}`);
      });
    }

    if (
      typedConfig.infrastructure &&
      Array.isArray(typedConfig.infrastructure.clouds)
    ) {
      typedConfig.infrastructure.clouds.forEach((cloud, cloudIndex) => {
        checkId(cloud?.id, `/infrastructure/clouds/${cloudIndex}`);
        if (cloud && Array.isArray(cloud.services)) {
          cloud.services.forEach((service, serviceIndex) => {
            checkId(
              service?.id,
              `/infrastructure/clouds/${cloudIndex}/services/${serviceIndex}`
            );
          });
        }
      });
    }

    if (Array.isArray(typedConfig.connections)) {
      typedConfig.connections.forEach((conn, index) => {
        checkId(conn?.id, `/connections/${index}`);
      });
    }
  }

  for (const extension of options.extensions ?? []) {
    errors.push(...(extension.validate?.(config) ?? []));
  }

  if (errors.length === 0) {
    return { valid: true };
  } else {
    return {
      valid: false,
      errors: errors,
    };
  }
}
