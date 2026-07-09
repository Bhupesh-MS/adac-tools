import { describe, it, expect } from 'vitest';
import * as Module from '../src/index';

describe('index.ts', () => {
  it('should re-export generateDiagram from `@mindfiredigital/adac-core`', async () => {
    expect(Module).toBeDefined();
    expect(Module).toHaveProperty('generateDiagram');
    expect(typeof Module.generateDiagram).toBe('function');
  });

  it('should generate diagrams with compliance tooltips from the diagram package', async () => {
    const yaml = `
version: "0.1"
metadata:
  name: "Compliance Arch"
  created: "2023-11-01"
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "vm-1"
          service: "ec2"
          name: "Server"
          compliance:
            - soc2
          configuration:
            instance_type: "t3.micro"
`;

    const result = await Module.generateDiagramSvg(yaml, 'custom');

    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('soc2');
  });
});
