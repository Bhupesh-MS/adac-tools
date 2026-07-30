import { describe, expect, it } from 'vitest';
import { OrthogonalLayoutEngine } from '../../layout-core/src/orthogonal-layout-engine';

function expectManhattan(points: Array<{ x: number; y: number }>) {
  expect(points.length).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    expect(current.x === next.x || current.y === next.y).toBe(true);
  }
}

describe('OrthogonalLayoutEngine', () => {
  it('returns empty bounds for an empty graph', () => {
    const engine = new OrthogonalLayoutEngine();

    const result = engine.layout();

    expect(result.nodes).toEqual({});
    expect(result.edges).toEqual({});
    expect(result.bounds).toEqual({ width: 50, height: 50 });
  });

  it('lays out a single node using sanitized defaults', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('api', { width: 0, height: Number.NaN });

    const result = engine.layout();

    expect(result.nodes.api).toMatchObject({
      x: 50,
      y: 50,
      width: 96,
      height: 116,
    });
    expect(result.bounds.width).toBeGreaterThan(result.nodes.api.x);
    expect(result.bounds.height).toBeGreaterThan(result.nodes.api.y);
  });

  it('produces deterministic balanced node placement', () => {
    const create = () => {
      const engine = new OrthogonalLayoutEngine({
        nodesep: 100,
        ranksep: 100,
      });
      for (const id of ['api', 'db', 'queue', 'worker']) {
        engine.addNode(id, { width: 100, height: 80 });
      }
      engine.addEdge('api', 'db');
      engine.addEdge('api', 'queue');
      engine.addEdge('worker', 'queue');
      return engine.layout();
    };

    const first = create();
    const second = create();

    expect(first).toEqual(second);
    expect(new Set(Object.values(first.nodes).map((node) => node.x)).size).toBe(
      2
    );
    expect(new Set(Object.values(first.nodes).map((node) => node.y)).size).toBe(
      2
    );
  });

  it('routes every edge as a strict orthogonal polyline', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('api', { width: 100, height: 80 });
    engine.addNode('queue', { width: 100, height: 80 });
    engine.addNode('db', { width: 120, height: 90 });
    engine.addEdge('api', 'queue', { id: 'api-to-queue' });
    engine.addEdge('queue', 'db', { id: 'queue-to-db' });

    const result = engine.layout();

    expect(Object.keys(result.edges)).toEqual(['api-to-queue', 'queue-to-db']);
    for (const edge of Object.values(result.edges)) {
      expectManhattan(edge.points);
      for (const point of edge.points) {
        expect(point.x % 10).toBe(0);
        expect(point.y % 10).toBe(0);
      }
    }
  });

  it('ignores edges with missing endpoints without impacting valid edges', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('api', { width: 100, height: 80 });
    engine.addNode('db', { width: 100, height: 80 });
    engine.addEdge('api', 'missing', { id: 'bad-edge' });
    engine.addEdge('api', 'db', { id: 'good-edge' });

    const result = engine.layout();

    expect(result.edges['bad-edge']).toBeUndefined();
    expect(result.edges['good-edge']).toBeDefined();
    expectManhattan(result.edges['good-edge'].points);
  });

  it('routes self loops outside the node box', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('cache', { width: 100, height: 80 });
    engine.addEdge('cache', 'cache', { id: 'cache-loop' });

    const result = engine.layout();
    const node = result.nodes.cache;
    const loop = result.edges['cache-loop'].points;

    expectManhattan(loop);
    expect(loop.some((point) => point.x > node.x + node.width)).toBe(true);
    expect(loop.some((point) => point.y > node.y + node.height)).toBe(true);
  });
});
