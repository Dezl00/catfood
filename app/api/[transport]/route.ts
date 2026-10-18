import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { verifyMcpSecret } from '../../../lib/mcp-auth.ts';
import {
  listBrands,
  getBrand,
  createBrand,
  updateBrand,
  createProducts,
  updateProduct,
  listMedia,
  normalizeProductInput,
} from '../../../lib/database.js';
import {
  importProductsBatch,
  uploadImageFromSource,
  getCatalogStats,
  type ImportProductItemInput,
} from '../../../lib/mcp-service.ts';
import { sanitizeText, sanitizeBarcode, sanitizeUrl } from '../../../lib/sanitize.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProductRecord {
  id: string;
  brandId: string;
  nameAr: string;
  nameEn: string;
  categoryAr?: string;
  categoryEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  barcode: string;
  imageUrl: string;
  variants?: unknown[];
  position?: number;
}

interface BrandRecord {
  id: string;
  nameAr: string;
  nameEn: string;
  logoUrl: string;
  settings: Record<string, unknown>;
  productCount: number;
  products?: ProductRecord[];
}

const getTypedBrand = getBrand as (id: string, includeProducts?: boolean) => Promise<BrandRecord | null>;
const listTypedMedia = listMedia as (opts: { brandId?: string; folder?: string; search?: string; limit?: number; offset?: number }) => Promise<unknown[]>;

// ============================================================================
// ZOD SCHEMAS FOR STRICT INPUT VALIDATION
// ============================================================================

const VariantInputSchema = z.object({
  id: z.string().max(100).optional(),
  weight: z.string().max(50).optional().describe('الوزن مثل 400 أو 1.5'),
  unit: z.string().max(20).optional().describe('الوحدة مثل جم أو كجم أو g أو kg'),
  sku: z.string().max(64).optional().describe('رمز الصنف أو الباركود الخاص بالمقاس'),
  qtyPerCarton: z.string().max(20).optional().describe('عدد القطع داخل الكرتون'),
  pricePerPiece: z.string().max(20).optional().describe('سعر الحبة أو القطعة الفردية'),
  pricePerCarton: z.string().max(20).optional().describe('سعر الكرتون الكامل'),
});

const BrandSettingsSchema = z.object({
  footerText: z.string().max(250).optional(),
  currency: z.string().max(20).optional(),
  visible: z
    .object({
      description: z.boolean().optional(),
      prices: z.boolean().optional(),
      cartonPrice: z.boolean().optional(),
      carton: z.boolean().optional(),
      barcode: z.boolean().optional(),
    })
    .optional(),
});

const ProductItemInputSchema = z.object({
  id: z.string().max(100).optional(),
  nameAr: z.string().max(250).optional().describe('اسم المنتج بالعربي'),
  nameEn: z.string().max(250).optional().describe('اسم المنتج بالإنجليزي'),
  categoryAr: z.string().max(100).optional().describe('التصنيف بالعربي'),
  categoryEn: z.string().max(100).optional().describe('التصنيف بالإنجليزي'),
  descriptionAr: z.string().max(2000).optional().describe('الوصف العربي في البطاقة'),
  descriptionEn: z.string().max(2000).optional().describe('الوصف الإنجليزي في البطاقة'),
  barcode: z.string().max(64).optional().describe('الباركود الأساسي للمنتج'),
  imageUrl: z.string().url().or(z.literal('')).optional().describe('رابط صورة المنتج المباشر'),
  weight: z.string().max(50).optional().describe('الوزن (إذا لم تكن المقاسات محددة)'),
  unit: z.string().max(20).optional().describe('الوحدة'),
  qtyPerCarton: z.string().max(20).optional().describe('العدد بالكرتون'),
  pricePerPiece: z.string().max(20).optional().describe('سعر الحبة'),
  pricePerCarton: z.string().max(20).optional().describe('سعر الكرتون'),
  variants: z.array(VariantInputSchema).max(30).optional().describe('جدول المقاسات والأوزان والأسعار'),
});

// Helper for standardized MCP tool error results
function toolError(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `خطأ: ${message}` }],
  };
}

// Helper for standardized MCP tool success results
function toolSuccess(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

// ============================================================================
// MCP HANDLER INITIALIZATION
// ============================================================================

const mcpHandler = createMcpHandler(
  (server) => {
    // ------------------------------------------------------------------------
    // 1. READ TOOLS
    // ------------------------------------------------------------------------

    // list_brands
    server.registerTool(
      'list_brands',
      {
        description:
          '[قراءة فقط / Read-only] استعراض قائمة جميع البراندات المسجلة في الكتالوج مع عدد المنتجات وتفاصيل الشعار وإعدادات العرض.',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const brands = await listBrands();
          return toolSuccess({
            count: brands.length,
            brands,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // get_brand
    server.registerTool(
      'get_brand',
      {
        description:
          '[قراءة فقط / Read-only] جلب تفاصيل براند محدد بواسطة المعرف (brandId) شاملاً إعداداته وجميع صفحات منتجاته.',
        inputSchema: z.object({
          brandId: z.string().min(1, 'معرف البراند (brandId) مطلوب'),
          includeProducts: z.boolean().default(true).optional().describe('تضمين قائمة المنتجات التابعة للبراند'),
        }),
      },
      async ({ brandId, includeProducts = true }) => {
        try {
          const brand = await getBrand(sanitizeText(brandId), includeProducts);
          if (!brand) {
            return toolError(`البراند برقم «${brandId}» غير موجود.`);
          }
          return toolSuccess(brand);
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // list_products
    server.registerTool(
      'list_products',
      {
        description:
          '[قراءة فقط / Read-only] استعراض صفحات المنتجات التابعة لبراند محدد مع إمكانية البحث بالاسم أو الباركود أو الترقيم.',
        inputSchema: z.object({
          brandId: z.string().min(1, 'معرف البراند (brandId) مطلوب'),
          search: z.string().max(100).optional().describe('بحث في الاسم أو الباركود أو الوصف'),
          limit: z.number().int().min(1).max(250).default(100).optional(),
          offset: z.number().int().min(0).default(0).optional(),
        }),
      },
      async ({ brandId, search, limit = 100, offset = 0 }) => {
        try {
          const cleanBrandId = sanitizeText(brandId);
          const brand = await getTypedBrand(cleanBrandId, true);
          if (!brand) {
            return toolError(`البراند برقم «${brandId}» غير موجود.`);
          }

          let items = brand.products || [];
          if (search && search.trim()) {
            const query = search.trim().toLowerCase();
            items = items.filter(
              (p) =>
                (p.nameAr && p.nameAr.toLowerCase().includes(query)) ||
                (p.nameEn && p.nameEn.toLowerCase().includes(query)) ||
                (p.barcode && p.barcode.toLowerCase().includes(query)) ||
                (p.categoryAr && p.categoryAr.toLowerCase().includes(query)) ||
                (p.categoryEn && p.categoryEn.toLowerCase().includes(query))
            );
          }

          const paginated = items.slice(offset, offset + limit);
          return toolSuccess({
            brandId: cleanBrandId,
            brandName: brand.nameAr,
            totalFound: items.length,
            limit,
            offset,
            products: paginated,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // get_product
    server.registerTool(
      'get_product',
      {
        description:
          '[قراءة فقط / Read-only] جلب تفاصيل صفحة منتج فردية بواسطة معرف المنتج (productId) ومعرف البراند (brandId).',
        inputSchema: z.object({
          productId: z.string().min(1, 'معرف المنتج (productId) مطلوب'),
          brandId: z.string().min(1, 'معرف البراند (brandId) مطلوب'),
        }),
      },
      async ({ productId, brandId }) => {
        try {
          const cleanBrandId = sanitizeText(brandId);
          const cleanProductId = sanitizeText(productId);
          const brand = await getTypedBrand(cleanBrandId, true);
          if (!brand) {
            return toolError(`البراند برقم «${brandId}» غير موجود.`);
          }

          const product = (brand.products || []).find((p) => p.id === cleanProductId);
          if (!product) {
            return toolError(`المنتج برقم «${productId}» غير موجود في هذا البراند.`);
          }

          return toolSuccess(product);
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // get_stats
    server.registerTool(
      'get_stats',
      {
        description:
          '[قراءة فقط / Read-only] جلب إحصائيات عامة عن الكتالوج: إجمالي البراندات، إجمالي المنتجات، إجمالي الصور وحجم التخزين المستهلك في Cloudinary.',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const stats = await getCatalogStats();
          return toolSuccess(stats);
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // list_images
    server.registerTool(
      'list_images',
      {
        description:
          '[قراءة فقط / Read-only] استعراض الصور المتوفرة في المعرض السحابي (Cloudinary) لاستخدامها في ربط المنتجات أو الشعارات.',
        inputSchema: z.object({
          brandId: z.string().optional().describe('فلترة الصور التابعة لبراند محدد'),
          folder: z.string().optional().describe('مجلد المعرض مثل general أو اسم البراند'),
          search: z.string().optional().describe('بحث باسم ملف الصورة'),
          limit: z.number().int().min(1).max(250).default(50).optional(),
          offset: z.number().int().min(0).default(0).optional(),
        }),
      },
      async ({ brandId, folder, search, limit = 50, offset = 0 }) => {
        try {
          const images = await listTypedMedia({
            brandId: brandId ? sanitizeText(brandId) : undefined,
            folder: folder ? sanitizeText(folder) : undefined,
            search: search ? sanitizeText(search) : undefined,
            limit,
            offset,
          });
          return toolSuccess({
            count: images.length,
            limit,
            offset,
            images,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // ------------------------------------------------------------------------
    // 2. WRITE TOOLS
    // ------------------------------------------------------------------------

    // create_brand
    server.registerTool(
      'create_brand',
      {
        description:
          '[تعديل بيانات / Mutation] إنشاء براند جديد في الكتالوج (الاسم بالعربي إلزامي، والشعار وإعدادات التصميم اختيارية).',
        inputSchema: z.object({
          nameAr: z.string().min(1, 'اسم البراند بالعربي مطلوب').max(100),
          nameEn: z.string().max(100).optional().default(''),
          logoUrl: z.string().url().or(z.literal('')).optional().default(''),
          settings: BrandSettingsSchema.optional(),
        }),
      },
      async (input) => {
        try {
          const brand = await createBrand({
            id: crypto.randomUUID(),
            nameAr: sanitizeText(input.nameAr, 100),
            nameEn: sanitizeText(input.nameEn, 100),
            logoUrl: sanitizeUrl(input.logoUrl),
            settings: input.settings || {},
          });
          return toolSuccess({
            message: `تم إنشاء البراند «${brand.nameAr}» بنجاح.`,
            brand,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // update_brand
    server.registerTool(
      'update_brand',
      {
        description:
          '[تعديل بيانات / Mutation] تحديث بيانات براند موجود (تعديل الاسم العربي أو الإنجليزي، الشعار، أو إعدادات العرض).',
        inputSchema: z.object({
          brandId: z.string().min(1, 'معرف البراند (brandId) مطلوب'),
          nameAr: z.string().min(1).max(100).optional(),
          nameEn: z.string().max(100).optional(),
          logoUrl: z.string().url().or(z.literal('')).optional(),
          settings: BrandSettingsSchema.optional(),
        }),
      },
      async (input) => {
        try {
          const cleanBrandId = sanitizeText(input.brandId);
          const current = await getBrand(cleanBrandId, false);
          if (!current) {
            return toolError(`البراند برقم «${input.brandId}» غير موجود.`);
          }

          const updated = await updateBrand(cleanBrandId, {
            nameAr: input.nameAr ? sanitizeText(input.nameAr, 100) : current.nameAr,
            nameEn: input.nameEn !== undefined ? sanitizeText(input.nameEn, 100) : current.nameEn,
            logoUrl: input.logoUrl !== undefined ? sanitizeUrl(input.logoUrl) : current.logoUrl,
            settings: input.settings ? { ...current.settings, ...input.settings } : current.settings,
          });

          return toolSuccess({
            message: `تم تحديث البراند «${updated?.nameAr || cleanBrandId}» بنجاح.`,
            brand: updated,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // create_product
    server.registerTool(
      'create_product',
      {
        description:
          '[تعديل بيانات / Mutation] إنشاء صفحة منتج فردية جديدة داخل براند محدد مع جدول المقاسات والأسعار.',
        inputSchema: z.object({
          brandId: z.string().min(1, 'معرف البراند (brandId) مطلوب'),
          nameAr: z.string().max(250).optional().describe('اسم المنتج بالعربي'),
          nameEn: z.string().max(250).optional().describe('اسم المنتج بالإنجليزي'),
          categoryAr: z.string().max(100).optional(),
          categoryEn: z.string().max(100).optional(),
          descriptionAr: z.string().max(2000).optional(),
          descriptionEn: z.string().max(2000).optional(),
          barcode: z.string().max(64).optional(),
          imageUrl: z.string().url().or(z.literal('')).optional(),
          variants: z.array(VariantInputSchema).max(30).optional(),
        }),
      },
      async (input) => {
        try {
          const cleanBrandId = sanitizeText(input.brandId);
          const brand = await getBrand(cleanBrandId, false);
          if (!brand) {
            return toolError(`البراند برقم «${input.brandId}» غير موجود.`);
          }

          const nameAr = sanitizeText(input.nameAr, 250);
          const nameEn = sanitizeText(input.nameEn, 250);
          if (!nameAr && !nameEn) {
            return toolError('يجب تحديد اسم المنتج بالعربي أو بالإنجليزي على الأقل.');
          }

          const normalized = normalizeProductInput({
            nameAr,
            nameEn,
            categoryAr: sanitizeText(input.categoryAr, 100),
            categoryEn: sanitizeText(input.categoryEn, 100),
            descriptionAr: sanitizeText(input.descriptionAr, 2000),
            descriptionEn: sanitizeText(input.descriptionEn, 2000),
            barcode: sanitizeBarcode(input.barcode),
            imageUrl: sanitizeUrl(input.imageUrl),
            variants: input.variants || [],
          });

          const createdList = await createProducts(cleanBrandId, [normalized]);
          const created = createdList[0];

          return toolSuccess({
            message: `تم إنشاء صفحة المنتج «${created?.nameAr || created?.nameEn}» بنجاح.`,
            product: created,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // update_product
    server.registerTool(
      'update_product',
      {
        description:
          '[تعديل بيانات / Mutation] تحديث بيانات أو أسعار أو صور صفحة منتج موجودة داخل براند محدد.',
        inputSchema: z.object({
          productId: z.string().min(1, 'معرف المنتج (productId) مطلوب'),
          brandId: z.string().min(1, 'معرف البراند (brandId) مطلوب'),
          nameAr: z.string().max(250).optional(),
          nameEn: z.string().max(250).optional(),
          categoryAr: z.string().max(100).optional(),
          categoryEn: z.string().max(100).optional(),
          descriptionAr: z.string().max(2000).optional(),
          descriptionEn: z.string().max(2000).optional(),
          barcode: z.string().max(64).optional(),
          imageUrl: z.string().url().or(z.literal('')).optional(),
          variants: z.array(VariantInputSchema).max(30).optional(),
        }),
      },
      async (input) => {
        try {
          const cleanBrandId = sanitizeText(input.brandId);
          const cleanProductId = sanitizeText(input.productId);

          const brand = await getTypedBrand(cleanBrandId, true);
          if (!brand) {
            return toolError(`البراند برقم «${input.brandId}» غير موجود.`);
          }

          const existing = (brand.products || []).find((p) => p.id === cleanProductId);
          if (!existing) {
            return toolError(`المنتج برقم «${input.productId}» غير موجود في هذا البراند.`);
          }

          const updated = await updateProduct(cleanProductId, cleanBrandId, {
            nameAr: input.nameAr !== undefined ? sanitizeText(input.nameAr, 250) : existing.nameAr,
            nameEn: input.nameEn !== undefined ? sanitizeText(input.nameEn, 250) : existing.nameEn,
            categoryAr: input.categoryAr !== undefined ? sanitizeText(input.categoryAr, 100) : existing.categoryAr,
            categoryEn: input.categoryEn !== undefined ? sanitizeText(input.categoryEn, 100) : existing.categoryEn,
            descriptionAr: input.descriptionAr !== undefined ? sanitizeText(input.descriptionAr, 2000) : existing.descriptionAr,
            descriptionEn: input.descriptionEn !== undefined ? sanitizeText(input.descriptionEn, 2000) : existing.descriptionEn,
            barcode: input.barcode !== undefined ? sanitizeBarcode(input.barcode) : existing.barcode,
            imageUrl: input.imageUrl !== undefined ? sanitizeUrl(input.imageUrl) : existing.imageUrl,
            variants: input.variants !== undefined ? input.variants : existing.variants,
          });

          return toolSuccess({
            message: `تم تحديث المنتج «${updated?.nameAr || updated?.nameEn || cleanProductId}» بنجاح.`,
            product: updated,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // upload_image
    server.registerTool(
      'upload_image',
      {
        description:
          '[تعديل بيانات / Mutation] رفع صورة جديدة إلى Cloudinary من رابط URL خارجي أو كود Base64 وفهرستها في معرض الكتالوج.',
        inputSchema: z.object({
          source: z.string().min(5, 'مصدر الصورة مطلوب (رابط URL أو Base64 Data URI)'),
          folder: z.string().max(80).default('general').optional().describe('مجلد المعرض في Cloudinary'),
          brandId: z.string().optional().describe('معرف البراند لربط الصورة به'),
          filename: z.string().max(100).optional().describe('اسم ملف الصورة الأصلي'),
        }),
      },
      async (input) => {
        try {
          const result = await uploadImageFromSource({
            source: input.source,
            folder: input.folder,
            brandId: input.brandId,
            filename: input.filename,
          });

          return toolSuccess({
            message: 'تم رفع الصورة وحفظها بنجاح.',
            image: result,
          });
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );

    // import_products
    server.registerTool(
      'import_products',
      {
        description:
          '[تعديل دفعة بيانات / Batch Mutation] إدخال دفعة منتجات كاملة إلى البراند بنفس قواعد استيراد Excel، مع دعم وضع المعاينة (dryRun)، ومنع التكرار (idempotency)، والتنفيذ داخل Transaction ذرية تنجح كلها أو تفشل كلها.',
        inputSchema: z.object({
          brandId: z.string().min(1, 'معرف البراند (brandId) مطلوب'),
          products: z
            .array(ProductItemInputSchema)
            .min(1, 'يجب إرسال منتج واحد على الأقل')
            .max(100, 'الحد الأقصى للدفعة الواحدة هو 100 منتج'),
          dryRun: z
            .boolean()
            .default(false)
            .optional()
            .describe('وضع المعاينة: عند تفعيله يتم فحص وتطبيع المنتجات واكتشاف التكرارات دون تعديل الداتا'),
          idempotencyKeyField: z
            .enum(['auto', 'barcode', 'name'])
            .default('auto')
            .optional()
            .describe('مفتاح عدم التكرار: auto (باركود أولاً ثم الاسم)، أو barcode، أو name'),
          onDuplicate: z
            .enum(['update', 'skip', 'error'])
            .default('update')
            .optional()
            .describe('السلوك عند العثور على منتج مكرر: update لتحديثه، skip لتخطيه، error لإلغاء الدفعة'),
        }),
      },
      async ({ brandId, products, dryRun = false, idempotencyKeyField = 'auto', onDuplicate = 'update' }) => {
        try {
          const result = await importProductsBatch(brandId, products as ImportProductItemInput[], {
            dryRun,
            idempotencyKeyField,
            onDuplicate,
          });

          if (!result.success) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: 'فشلت معالجة دفعة المنتجات لوجود أخطاء في المدخلات.',
                      ...result,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          return toolSuccess(result);
        } catch (err) {
          return toolError(err instanceof Error ? err.message : String(err));
        }
      }
    );
  },
  {
    serverInfo: {
      name: 'Catfood Catalog MCP Server',
      version: '1.0.0',
    },
  }
);

// ============================================================================
// HTTP ROUTE HANDLERS
// ============================================================================

export async function GET(request: Request) {
  if (!verifyMcpSecret(request)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing MCP_SECRET.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  return mcpHandler(request);
}

export async function POST(request: Request) {
  if (!verifyMcpSecret(request)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing MCP_SECRET.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  return mcpHandler(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    },
  });
}
