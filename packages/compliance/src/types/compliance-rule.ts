import type { AdacConfig } from '@mindfiredigital/adac-validator';
import { Violation } from './violation';

type AdacService =
  AdacConfig['infrastructure']['clouds'][number]['services'][number];

export interface EvaluationContext {
  config: AdacConfig;
}

export interface ComplianceRule {
  id: string;
  frameworks: string[];
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evaluate(service: AdacService, context: EvaluationContext): Violation | null;
}
