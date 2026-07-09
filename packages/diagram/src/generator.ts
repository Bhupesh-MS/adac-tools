import {
  generateDiagram as coreGenerateDiagram,
  generateDiagramSvg as coreGenerateDiagramSvg,
  type ComplianceTooltipMap,
  type GenerationResult,
} from '@mindfiredigital/adac-core';
import type { AdacConfig } from '@mindfiredigital/adac-validator';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';

type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';

function buildComplianceTooltipMap(adac: AdacConfig): ComplianceTooltipMap {
  const checker = new ComplianceChecker();
  const { byService } = checker.checkCompliance(adac);
  const complianceTooltipMap: ComplianceTooltipMap = {};

  for (const [serviceId, results] of Object.entries(byService)) {
    const frameworks = results.map((r) => r.framework);
    const violations: string[] = [];

    for (const result of results) {
      if (!result.isCompliant) {
        result.violations.forEach((v) => {
          violations.push(
            `[${result.framework.toUpperCase()} - ${v.severity.toUpperCase()}] ${v.message}`
          );
        });
      }
    }

    complianceTooltipMap[serviceId] = { frameworks, violations };
  }

  return complianceTooltipMap;
}

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: 'elk' | 'custom',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false
): Promise<GenerationResult> {
  return coreGenerateDiagramSvg(
    inputContent,
    layoutOverride,
    validate,
    costData,
    period,
    skipOptimizer,
    buildComplianceTooltipMap
  );
}

export async function generateDiagram(
  input: string,
  output: string,
  layoutOverride?: 'elk' | 'custom',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false
): Promise<void> {
  return coreGenerateDiagram(
    input,
    output,
    layoutOverride,
    validate,
    costData,
    period,
    skipOptimizer,
    buildComplianceTooltipMap
  );
}
