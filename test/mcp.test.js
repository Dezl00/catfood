import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifyMcpSecret } from '../lib/mcp-auth.ts';
import {
  sanitizeText,
  sanitizeBarcode,
  sanitizeNumberString,
  sanitizeUrl,
} from '../lib/sanitize.ts';
import {
  normalizeIncomingProduct,
  importProductsBatch,
} from '../lib/mcp-service.ts';
import { POST as mcpPostHandler, GET as mcpGetHandler } from '../app/api/[transport]/route.ts';

// ============================================================================
// 1. MCP AUTHENTICATION TESTS (MCP_SECRET & timingSafeEqual)
// ============================================================================

describe('MCP Secret Authentication (verifyMcpSecret)', () => {
  const originalEnv = process.env.MCP_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MCP_SECRET = originalEnv;
    } else {
      delete process.env.MCP_SECRET;
    }
  });

  it('allows open access when MCP_SECRET is not configured in env', () => {
    delete process.env.MCP_SECRET;
    const req = new Request('http://localhost:3000/api/mcp', { method: 'POST' });
    assert.equal(verifyMcpSecret(req), true);
  });

  it('rejects requests when MCP_SECRET is set but no token is provided', () => {
    process.env.MCP_SECRET = 'secret_token_12345';
    const req = new Request('http://localhost:3000/api/mcp', { method: 'POST' });
    assert.equal(verifyMcpSecret(req), false);
  });

  it('rejects requests with incorrect Bearer token', () => {
    process.env.MCP_SECRET = 'secret_token_12345';
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong_token_xyz' },
    });
    assert.equal(verifyMcpSecret(req), false);
  });

  it('accepts requests with valid Bearer token', () => {
    process.env.MCP_SECRET = 'secret_token_12345';
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer secret_token_12345' },
    });
    assert.equal(verifyMcpSecret(req), true);
  });

  it('accepts requests with valid secret in query param (?secret=...)', () => {
    process.env.MCP_SECRET = 'secret_token_12345';
    const req = new Request('http://localhost:3000/api/mcp?secret=secret_token_12345', {
      method: 'GET',
    });
    assert.equal(verifyMcpSecret(req), true);
  });

  it('accepts requests with valid apiKey in query param (?apiKey=...)', () => {
    process.env.MCP_SECRET = 'secret_token_12345';
    const req = new Request('http://localhost:3000/api/mcp?apiKey=secret_token_12345', {
      method: 'POST',
    });
    assert.equal(verifyMcpSecret(req), true);
  });

  it('HTTP handler returns 401 when MCP_SECRET is configured and token is missing', async () => {
    process.env.MCP_SECRET = 'secret_guard_999';
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await mcpPostHandler(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Unauthorized'));
  });
});

// ============================================================================
// 2. INPUT SANITIZATION TESTS
// ============================================================================

describe('Input Sanitization (sanitize.ts)', () => {
  it('strips ASCII control characters while preserving valid newlines', () => {
    const input = 'طعام قطط\x00\x07 ممتاز\nوصف جديد\tمع تفاصيل\x1F';
    const clean = sanitizeText(input);
    assert.equal(clean, 'طعام قطط ممتاز\nوصف جديد\tمع تفاصيل');
  });

  it('strips script tags and malicious HTML injections', () => {
    const input = 'طعام قطط <script>alert("hack")</script> صحي وطبيعي';
    const clean = sanitizeText(input);
    assert.equal(clean, 'طعام قطط  صحي وطبيعي');
  });

  it('sanitizes barcode values and strips whitespace/controls', () => {
    assert.equal(sanitizeBarcode('  6281234567890 \x00 '), '6281234567890');
    assert.equal(sanitizeBarcode(null), '');
  });

  it('sanitizes number strings and rejects negative or NaN values', () => {
    assert.equal(sanitizeNumberString(' 150.50 '), '150.5');
    assert.equal(sanitizeNumberString('12'), '12');
    assert.equal(sanitizeNumberString('-50'), '');
    assert.equal(sanitizeNumberString('abc'), '');
    assert.equal(sanitizeNumberString(''), '');
  });

  it('validates and sanitizes URLs', () => {
    assert.equal(sanitizeUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg'), 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
    assert.equal(sanitizeUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeUrl('not a url'), '');
    assert.equal(sanitizeUrl(''), '');
  });
});

// ============================================================================
// 3. PRODUCT NORMALIZATION & EXCEL RULES REUSE
// ============================================================================

describe('Product Normalization (normalizeIncomingProduct)', () => {
  it('automatically extracts weight and unit from Arabic product title', () => {
    const raw = {
      nameAr: 'دراي فود للقطط الصغيرة بالدجاج 400 جم',
      pricePerPiece: '85',
      pricePerCarton: '1020',
      qtyPerCarton: '12',
    };
    const { product, error } = normalizeIncomingProduct(raw, 'brand-1');
    assert.equal(error, null);
    assert.ok(product);
    assert.equal(product.variants.length, 1);
    assert.equal(product.variants[0].weight, '400');
    assert.equal(product.variants[0].unit, 'g');
    assert.equal(product.variants[0].qtyPerCarton, '12');
    assert.equal(product.variants[0].pricePerPiece, '85');
    assert.equal(product.variants[0].pricePerCarton, '1020');
  });

  it('automatically extracts weight and unit from English product title', () => {
    const raw = {
      nameEn: 'Adult Cat Salmon 1.5kg',
      barcode: '6289988776655',
    };
    const { product, error } = normalizeIncomingProduct(raw, 'brand-1');
    assert.equal(error, null);
    assert.ok(product);
    assert.equal(product.variants[0].weight, '1.5');
    assert.equal(product.variants[0].unit, 'kg');
    assert.equal(product.barcode, '6289988776655');
    assert.equal(product.idempotencyKey, 'barcode:6289988776655');
  });

  it('creates default variant when variants array is not supplied', () => {
    const raw = {
      nameAr: 'معلبات تونة',
      weight: '85',
      unit: 'جم',
      pricePerPiece: '25',
    };
    const { product, error } = normalizeIncomingProduct(raw, 'brand-1');
    assert.equal(error, null);
    assert.ok(product);
    assert.equal(product.variants.length, 1);
    assert.equal(product.variants[0].weight, '85');
    assert.equal(product.variants[0].unit, 'g');
    assert.equal(product.variants[0].pricePerPiece, '25');
  });

  it('preserves multi-variant definitions when provided', () => {
    const raw = {
      nameAr: 'طعام جاف متعدد الأحجام',
      variants: [
        { weight: '400', unit: 'جم', pricePerPiece: '90' },
        { weight: '1.5', unit: 'كجم', pricePerPiece: '250' },
        { weight: '10', unit: 'كجم', pricePerPiece: '1200' },
      ],
    };
    const { product, error } = normalizeIncomingProduct(raw, 'brand-1');
    assert.equal(error, null);
    assert.ok(product);
    assert.equal(product.variants.length, 3);
    assert.equal(product.variants[0].weight, '400');
    assert.equal(product.variants[0].unit, 'g');
    assert.equal(product.variants[1].weight, '1.5');
    assert.equal(product.variants[1].unit, 'kg');
    assert.equal(product.variants[2].weight, '10');
    assert.equal(product.variants[2].unit, 'kg');
  });

  it('fails with validation error when both nameAr and nameEn are missing', () => {
    const raw = {
      barcode: '123456',
      pricePerPiece: '10',
    };
    const { product, error } = normalizeIncomingProduct(raw, 'brand-1');
    assert.equal(product, null);
    assert.ok(error?.includes('nameAr'));
  });

  it('determines idempotency key correctly by barcode when available, fallback to name', () => {
    const withBarcode = { nameAr: 'منتج أ', barcode: 'BC-999' };
    const { product: p1 } = normalizeIncomingProduct(withBarcode, 'brand-1', 'auto');
    assert.equal(p1?.idempotencyKey, 'barcode:bc-999');

    const withoutBarcode = { nameAr: 'منتج ب' };
    const { product: p2 } = normalizeIncomingProduct(withoutBarcode, 'brand-1', 'auto');
    assert.equal(p2?.idempotencyKey, 'name:منتج ب');
  });
});

// ============================================================================
// 4. MCP TOOLS REGISTRATION & PROTOCOL VERIFICATION
// ============================================================================

describe('MCP Protocol Endpoint (tools/list & tools/call)', () => {
  beforeEach(() => {
    delete process.env.MCP_SECRET;
  });

  it('serves tools/list containing all required read and write tools', async () => {
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/list',
        params: {},
      }),
    });

    const res = await mcpPostHandler(req);
    assert.equal(res.status, 200);

    const bodyText = await res.text();
    assert.ok(bodyText.includes('"tools"'));

    const requiredTools = [
      'list_brands',
      'get_brand',
      'list_products',
      'get_product',
      'get_stats',
      'list_images',
      'create_brand',
      'update_brand',
      'create_product',
      'update_product',
      'upload_image',
      'import_products',
    ];

    for (const toolName of requiredTools) {
      assert.ok(bodyText.includes(`"name":"${toolName}"`), `Tool ${toolName} must be registered in tools/list`);
    }

    // Verify deletion tools are NOT registered
    assert.ok(!bodyText.includes('"name":"delete_brand"'), 'delete_brand must NOT be present');
    assert.ok(!bodyText.includes('"name":"delete_product"'), 'delete_product must NOT be present');
  });

  it('handles get_brand with non-existent ID gracefully with isError: true', async () => {
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'get_brand',
          arguments: { brandId: 'non_existent_fake_brand_id_123' },
        },
      }),
    });

    const res = await mcpPostHandler(req);
    assert.equal(res.status, 200);
    const bodyText = await res.text();
    assert.ok(bodyText.includes('isError') || bodyText.includes('غير موجود'));
  });

  it('rejects batch import with empty products array via Zod validation', async () => {
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 103,
        method: 'tools/call',
        params: {
          name: 'import_products',
          arguments: {
            brandId: 'b-1',
            products: [],
          },
        },
      }),
    });

    const res = await mcpPostHandler(req);
    assert.equal(res.status, 200);
    const bodyText = await res.text();
    assert.ok(bodyText.includes('error') || bodyText.includes('منتج واحد على الأقل'));
  });

  it('handles OPTIONS request with correct CORS headers', async () => {
    const { OPTIONS } = await import('../app/api/[transport]/route.ts');
    const res = await OPTIONS();
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.ok(res.headers.get('Access-Control-Allow-Methods')?.includes('POST'));
  });
});

// ============================================================================
// 5. BATCH IMPORT, IDEMPOTENCY & TRANSACTION TESTS
// ============================================================================

describe('Batch Import & Idempotency (importProductsBatch)', () => {
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://mock_user:mock_pass@localhost:5432/mock_db';
  });

  afterEach(() => {
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });
  it('detects duplicate items inside the same batch array', async () => {
    const originalPool = globalThis.catalogPool;
    globalThis.catalogPool = {
      query: async (sql) => {
        if (typeof sql === 'string' && sql.includes('catalog_brands WHERE id = $1')) {
          return { rowCount: 1, rows: [{ id: 'b-mock', name_ar: 'براند تجريبي', name_en: 'Test Brand', logo_url: '', settings: {}, created_at: new Date(), updated_at: new Date() }] };
        }
        if (typeof sql === 'string' && sql.includes('FROM catalog_products WHERE brand_id = $1')) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      },
      connect: async () => ({
        query: async () => ({ rowCount: 0, rows: [] }),
        release: () => {},
      }),
    };

    try {
      const items = [
        { nameAr: 'منتج أ', barcode: '123' },
        { nameAr: 'منتج أ مكرر', barcode: '123' },
      ];
      const result = await importProductsBatch('b-mock', items, { dryRun: true });
      assert.equal(result.errorCount, 1);
      assert.ok(result.errors[0].error.includes('مكرر داخل نفس الدفعة'));
    } finally {
      globalThis.catalogPool = originalPool;
    }
  });

  it('performs dryRun without executing transaction commands', async () => {
    const originalPool = globalThis.catalogPool;
    const clientQueries = [];
    const poolQueries = [];

    globalThis.catalogPool = {
      query: async (sql, params) => {
        poolQueries.push({ sql, params });
        if (typeof sql === 'string' && sql.includes('catalog_brands WHERE id = $1')) {
          return { rowCount: 1, rows: [{ id: 'b-mock', name_ar: 'براند تجريبي', name_en: 'Test Brand', logo_url: '', settings: {}, created_at: new Date(), updated_at: new Date() }] };
        }
        if (typeof sql === 'string' && sql.includes('FROM catalog_products WHERE brand_id = $1')) {
          return {
            rowCount: 1,
            rows: [{ id: 'p-existing-1', name_ar: 'منتج قديم', name_en: 'Old Product', barcode: '6280001', position: 0 }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
      connect: async () => ({
        query: async (sql, params) => {
          clientQueries.push({ sql, params });
          return { rowCount: 0, rows: [] };
        },
        release: () => {},
      }),
    };

    try {
      const items = [
        { nameAr: 'منتج جديد 400 جم', barcode: '6280002', pricePerPiece: '50' },
        { nameAr: 'منتج مكرر', barcode: '6280001', pricePerPiece: '60' },
      ];
      const result = await importProductsBatch('b-mock', items, { dryRun: true });

      assert.equal(result.dryRun, true);
      assert.equal(result.totalReceived, 2);
      assert.equal(result.createdCount, 1);
      assert.equal(result.updatedCount, 1);
      assert.equal(result.errorCount, 0);
      assert.ok(result.preview);
      assert.equal(result.preview.length, 2);
      // No client queries (BEGIN, INSERT, UPDATE, COMMIT) must have been executed
      assert.equal(clientQueries.length, 0);
    } finally {
      globalThis.catalogPool = originalPool;
    }
  });

  it('executes full transaction and handles rollback on database failure', async () => {
    const originalPool = globalThis.catalogPool;
    const clientQueries = [];

    globalThis.catalogPool = {
      query: async (sql) => {
        if (typeof sql === 'string' && sql.includes('catalog_brands WHERE id = $1')) {
          return { rowCount: 1, rows: [{ id: 'b-mock', name_ar: 'براند تجريبي', name_en: 'Test Brand', logo_url: '', settings: {}, created_at: new Date(), updated_at: new Date() }] };
        }
        if (typeof sql === 'string' && sql.includes('FROM catalog_products WHERE brand_id = $1')) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      },
      connect: async () => ({
        query: async (sql) => {
          clientQueries.push(sql);
          if (typeof sql === 'string' && sql.includes('BEGIN')) return { rowCount: 0, rows: [] };
          if (typeof sql === 'string' && sql.includes('MAX(position)')) return { rowCount: 1, rows: [{ next_pos: 0 }] };
          if (typeof sql === 'string' && sql.includes('INSERT INTO catalog_products')) {
            throw new Error('Simulated DB disk failure');
          }
          if (typeof sql === 'string' && sql.includes('ROLLBACK')) return { rowCount: 0, rows: [] };
          return { rowCount: 0, rows: [] };
        },
        release: () => {},
      }),
    };

    try {
      const items = [{ nameAr: 'منتج تجريبي', barcode: '111' }];
      await assert.rejects(
        async () => {
          await importProductsBatch('b-mock', items, { dryRun: false });
        },
        /Simulated DB disk failure/
      );

      // Verify transaction lifecycle: BEGIN followed by ROLLBACK
      assert.ok(clientQueries.some((q) => typeof q === 'string' && q.includes('BEGIN')));
      assert.ok(clientQueries.some((q) => typeof q === 'string' && q.includes('ROLLBACK')));
      assert.ok(!clientQueries.some((q) => typeof q === 'string' && q.includes('COMMIT')));
    } finally {
      globalThis.catalogPool = originalPool;
    }
  });
});

