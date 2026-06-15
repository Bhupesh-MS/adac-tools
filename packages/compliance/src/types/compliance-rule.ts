import { AdacConfig, AdacService } from '@mindfiredigital/adac-layout-core';
import { Violation } from './violation';

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
