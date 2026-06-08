import { describe, it, expect, vi } from 'vitest';
import { generateDiagramSvg } from '../src/generator.js';
import { renderSvg } from '../src/renderer.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('ADAC Core Generator', () => {
  const validYaml = `
version: "0.1"
metadata:
  name: "Test Arch"
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
          configuration:
            instance_type: "t3.micro"
`;

  it('should generate SVG from valid ADAC content', async () => {
    const result = await generateDiagramSvg(validYaml);
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('Server');
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it('should call generateDiagram string I/O successfully', async () => {
    const tmpFileIn = path.join(os.tmpdir(), 'test-in.yaml');
    const tmpFileOut = path.join(os.tmpdir(), 'test-out.svg');
    await fs.writeFile(tmpFileIn, validYaml);
    const { generateDiagram } = await import('../src/generator.js');
    await generateDiagram(tmpFileIn, tmpFileOut, 'elk', false);
    const content = await fs.readFile(tmpFileOut, 'utf8');
    expect(content).toContain('<svg');
  });

  it('should validate schema when requested', async () => {
    const result = await generateDiagramSvg(validYaml, undefined, true);
    expect(result.svg).toContain('<svg');
    expect(
      result.logs.some((l) => l.includes('Schema validation passed'))
    ).toBe(true);
  });

  it('should fail on invalid schema when validation is enabled', async () => {
    const invalidYaml = `
version: "0.1"
metadata:
  name: "Invalid"
  created: "2023-11-01"
infrastructure:
  clouds: []
`;
    await expect(
      generateDiagramSvg(invalidYaml, undefined, true)
    ).rejects.toThrow();
  });

  it('should format error without errors array when validation is enabled', async () => {
    // Spy on validateAdacConfig to return a falsy valid but undefined errors
    const schema = await import('@mindfiredigital/adac-schema');
    const spy = vi
      .spyOn(schema, 'validateAdacConfig')
      .mockReturnValueOnce({ valid: false });
    const invalidYaml = `version: "0.1"\nmetadata:\n  name: "Invalid"\n  created: "2023-11-01"\ninfrastructure:\n  clouds: []`;
    await expect(
      generateDiagramSvg(invalidYaml, undefined, true)
    ).rejects.toThrow(/Schema validation failed/);
    spy.mockRestore();
  });

  it('should use specified layout engine', async () => {
    const resultElk = await generateDiagramSvg(validYaml, 'elk');
    const resultDagre = await generateDiagramSvg(validYaml, 'dagre');
    expect(resultElk.svg).toContain('<svg');
    expect(resultDagre.svg).toContain('<svg');
  });

  it('should include compliance tooltips when compliance checks fail', async () => {
    const complianceSpy = vi
      .spyOn(
        await import('@mindfiredigital/adac-compliance'),
        'ComplianceChecker'
      )
      .mockImplementation(function () {
        return {
          checkCompliance: () => ({
            byService: {
              'vm-1': [
                {
                  framework: 'soc2',
                  isCompliant: false,
                  violations: [
                    {
                      ruleId: 'r1',
                      message: 'Not compliant error',
                      severity: 'high',
                      remediation: 'Fix it',
                    },
                  ],
                },
              ],
            },
          }),
        };
      });

    const result = await generateDiagramSvg(validYaml);
    expect(result.svg).toContain('soc2');
    expect(result.svg).toContain('Not compliant error');

    complianceSpy.mockRestore();
  });

  it('should handle optimizer errors gracefully', async () => {
    const optimizerModule = await import('@mindfiredigital/adac-optimizer');
    const analyzeSpy = vi
      .spyOn(optimizerModule.OptimizerEngine.prototype, 'analyze')
      .mockImplementation(() => {
        throw new Error('Fake optimizer error');
      });

    const result = await generateDiagramSvg(validYaml);
    expect(
      result.logs.some((l) =>
        l.includes('Optimizer error: Fake optimizer error')
      )
    ).toBe(true);

    analyzeSpy.mockRestore();
  });

  it('should include optimization tooltips when recommendations exist', async () => {
    const optimizerModule = await import('@mindfiredigital/adac-optimizer');
    const analyzeSpy = vi
      .spyOn(optimizerModule.OptimizerEngine.prototype, 'analyze')
      .mockImplementation(() => {
        return {
          summary: {
            total: 1,
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
            totalEstimatedSavingsUsd: 10,
          },
          recommendations: [
            {
              category: 'cost',
              title: 'Save money',
              severity: 'high',
              estimatedSavingsUsd: 10,
            },
          ],
          byService: {
            'vm-1': [
              {
                category: 'cost',
                title: 'Save money',
                severity: 'high',
                estimatedSavingsUsd: 10,
              },
            ],
          },
        };
      });

    const result = await generateDiagramSvg(validYaml);
    expect(result.svg).toContain('Est. Savings: $10.00/mo');
    expect(result.svg).toContain('[HIGH] Save money');

    analyzeSpy.mockRestore();
  });
});

describe('ADAC Core Renderer', () => {
  it('should render simple graph with ELK', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 100,
          height: 100,
          labels: [{ text: 'Node 1' }],
          properties: { type: 'service' },
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Node 1');
  });

  it('should render simple graph with Dagre', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 100,
          height: 100,
          labels: [{ text: 'Node 1' }],
          properties: { type: 'service' },
        },
      ],
      edges: [
        { id: 'edge-dagre', sources: ['n1'], targets: ['n1'], sections: [] },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'dagre');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Node 1');
  });

  it('should handle nested containers', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'c1',
          width: 200,
          height: 200,
          labels: [{ text: 'Container' }],
          properties: { type: 'container' },
          children: [
            {
              id: 'n1',
              width: 50,
              height: 50,
              labels: [{ text: 'Nested' }],
              properties: { type: 'service' },
            },
          ],
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('aws-container');
    expect(svg).toContain('Nested');
  });

  it('should render icons if iconPath is provided', async () => {
    const iconPath =
      'd:/adac-tools/packages/icons-aws/assets/aws-icons/image1001.jpg';
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 100,
          height: 100,
          labels: [{ text: 'Icon Node' }],
          properties: { type: 'service', iconPath },
        },
      ],
    };

    // spy and mock fs to pretend jpg exists and can be read
    const existSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(Buffer.from('binary-data'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('data:image/jpeg;base64');

    // now make it throw to catch 95-96
    readSpy.mockImplementationOnce(() => {
      throw new Error('EACCES');
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svgErr = await renderSvg(graph as any, 'elk');
    expect(svgErr).not.toContain('data:image/jpeg;base64');

    existSpy.mockRestore();
    readSpy.mockRestore();
  });

  it('should render edges', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        { id: 'n1', width: 50, height: 50, x: 0, y: 0 },
        { id: 'n2', width: 50, height: 50, x: 200, y: 0 },
      ],
      edges: [
        {
          id: 'e1',
          sources: ['n1'],
          targets: ['n2'],
          sections: [
            {
              id: 's1',
              startPoint: { x: 50, y: 25 },
              endPoint: { x: 200, y: 25 },
            },
          ],
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('class="aws-edge"');
    expect(svg).toContain('<path d="M');
  });

  it('should handle edge rendering details including labels, bendPoints and empty sections', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 120,
          height: 100,
          x: 0,
          y: 0,
          labels: [{ text: '<&> "escape\'' }],
          properties: { type: 'service' },
        },
        {
          id: 'n2',
          width: 120,
          height: 100,
          x: 150,
          y: 150,
          labels: [{ text: 'This is a very long text indeed' }],
          properties: { type: 'service' },
        },
        {
          id: 'c1',
          width: 100,
          height: 100,
          properties: { type: 'container', iconPath: 'dummy.png' },
          children: [
            { id: 'c1-stub', properties: { iconPath: 'dummy.png' } }, // trigger hasChildWithSameIcon
          ],
        },
        {
          id: 'c2',
          width: 100,
          height: 100,
          properties: { type: 'container', iconPath: 'dummy.png' },
          children: [
            { id: 'c2-child', properties: { iconPath: 'other.png' } }, // trigger container iconPath rendering
          ],
        },
        // node without id to hit fallback on lines 136-137
        {
          width: 50,
          height: 50,
          properties: { type: 'service' },
          edges: [
            { id: 'e-noid', sources: ['n1'], targets: ['n1'], sections: [] },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
      edges: [
        {
          id: 'e1',
          sources: ['n1'],
          targets: ['n1'],
          labels: [{ text: 'HTTP Request' }],
          sections: [
            {
              id: 's1',
              startPoint: { x: 50, y: 25 },
              endPoint: { x: 200, y: 25 },
              bendPoints: [{ x: 100, y: 25 }],
            },
          ],
        },
        {
          id: 'e2', // missing sections originally, now vertical to test vertical label
          sources: ['n1'],
          targets: ['n1'],
          labels: [{ text: 'Vertical' }],
          sections: [
            {
              id: 's2',
              startPoint: { x: 50, y: 25 },
              endPoint: { x: 50, y: 200 },
            },
          ],
        },
        {
          id: 'e3', // no sections property
          sources: ['n1'],
          targets: ['n1'],
          labels: [{ text: 'Missing Secs' }],
        },
      ],
    };

    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(Buffer.from('binary-data'));
    const existSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'dagre');
    expect(svg).toContain('aws-edge');
    expect(svg).toContain('M 90 65 L 140 65 L 240 65'); // bend point logic SVG
    expect(svg).toContain('&lt;&amp;&gt; &quot;escape&apos;'); // escapeXml
    expect(svg).toContain('long text indeed'); // split lines

    readSpy.mockRestore();
    existSpy.mockRestore();
  });
});
