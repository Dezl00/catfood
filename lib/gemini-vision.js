// lib/gemini-vision.js

let activeKeyIndex = 0;

export function getGeminiApiKeys() {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const list = raw
    .split(/[\n,;]+/)
    .map((k) => k.replace(/["']/g, '').trim())
    .filter(Boolean);
  return list;
}

export function getActiveKeyInfo() {
  const keys = getGeminiApiKeys();
  if (!keys.length) {
    throw new Error('لم يتم العثور على أي مفتاح GEMINI_API_KEYS في إعدادات البيئة.');
  }
  return {
    key: keys[activeKeyIndex % keys.length],
    index: (activeKeyIndex % keys.length) + 1,
    total: keys.length,
  };
}

export function rotateApiKey() {
  const keys = getGeminiApiKeys();
  if (keys.length <= 1) return;
  activeKeyIndex = (activeKeyIndex + 1) % keys.length;
  console.log(`[Gemini Vision] 🔄 تم التبديل إلى مفتاح API رقم ${activeKeyIndex + 1} من ${keys.length}`);
}

/**
 * Call Gemini API with automatic rotation on quota / rate limit errors
 */
export async function callGeminiWithRotation(payload, model = 'gemini-2.5-flash') {
  const keys = getGeminiApiKeys();
  if (!keys.length) {
    throw new Error('يرجى إضافة مفاتيح GEMINI_API_KEYS في .env.local');
  }

  let attempts = 0;
  let lastError = null;

  while (attempts < keys.length) {
    const key = keys[activeKeyIndex % keys.length];
    const keyNum = (activeKeyIndex % keys.length) + 1;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        return data;
      }

      const status = res.status;
      const errMsg = data.error?.message || '';
      const isQuotaOrLimit =
        status === 429 ||
        status === 403 ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('resource_exhausted') ||
        errMsg.toLowerCase().includes('rate');

      if (isQuotaOrLimit) {
        console.warn(`[Gemini Vision] ⚠️ المفتاح #${keyNum} وصل للحد الأقصى أو الحصة (${status}: ${errMsg.slice(0, 80)}). جاري التبديل للمفتاح التالي...`);
        rotateApiKey();
        attempts++;
        continue;
      }

      // If other client error (e.g. invalid key or bad request)
      if (status === 400 && errMsg.includes('API key not valid')) {
        console.warn(`[Gemini Vision] ⚠️ المفتاح #${keyNum} غير صالح. جاري التبديل...`);
        rotateApiKey();
        attempts++;
        continue;
      }

      throw new Error(`خطأ من Gemini (${status}): ${errMsg || 'فشل الاستجابة'}`);
    } catch (err) {
      lastError = err;
      if (err.message?.includes('Gemini') && !err.message?.includes('غير صالح')) {
        throw err;
      }
      rotateApiKey();
      attempts++;
    }
  }

  throw new Error(`تم استنفاد جميع مفاتيح API المتاحة (${keys.length} مفاتيح). تفاصيل الخطأ: ${lastError?.message || 'تجاوز الحصة'}`);
}

/**
 * Fetch image and convert to base64 inline data
 */
async function imageToInlineData(imageUrl) {
  if (typeof imageUrl === 'object' && imageUrl.base64 && imageUrl.mimeType) {
    return {
      mime_type: imageUrl.mimeType,
      data: imageUrl.base64,
    };
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`فشل تحميل الصورة: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  let mimeType = res.headers.get('content-type') || 'image/jpeg';
  if (mimeType.includes(';')) mimeType = mimeType.split(';')[0];
  if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg';

  return {
    mime_type: mimeType,
    data: base64,
  };
}

/**
 * Match a single image to the candidate products list using Gemini Vision
 */
export async function matchImageToProducts(imageUrl, candidateProducts) {
  if (!Array.isArray(candidateProducts) || !candidateProducts.length) {
    return {
      matchedProductId: null,
      confidence: 0,
      detectedDetails: null,
      reason: 'لا توجد منتجات مسجلة للمطابقة معها.',
    };
  }

  const inlineData = await imageToInlineData(imageUrl);

  const compactProducts = candidateProducts.map((p, idx) => ({
    id: p.id,
    index: idx + 1,
    nameAr: p.nameAr || p.name_ar || '',
    nameEn: p.nameEn || p.name_en || '',
    description: (p.descriptionAr || p.description_ar || '').slice(0, 300),
    weights: (p.variants || [])
      .map((v) => `${v.weight || ''} ${v.unit || 'g'}`.trim())
      .filter(Boolean)
      .join(', '),
  }));

  const prompt = `أنت خبير محترف في كتالوجات وتصنيف أغذية الحيوانات الأليفة (Pet Food).
انظر بدقة إلى تصميم وصورة عبوة المنتج المرفقة (كيس، علبة كانز، ظرف، أو مكافآت).
1. اقرأ جميع النصوص المطبوعة على العبوة: الماركة، الاسم، النكهات والمكونات الأساسية (دجاج، سالمون، تونة، بقر، توت، خضار)، الفئة المستهدفة (قطط Cats / كلاب Dogs)، المرحلة العمرية (Kitten صغار / Adult بالغة / Sterilised معقمة)، قوام الأكل (Pate باتيه / Gravy مرق / Dry جاف / Treats مكافآت مقرمشة)، والوزن المكتوب بالجرام أو الكيلو.
2. حلل تصميم العبوة وألوانها والرسومات المطبوعة عليها.
3. قارن بدقة ما وجدته على العبوة بقائمة المنتجات التالية المسجلة في قاعدة البيانات:
${JSON.stringify(compactProducts, null, 2)}

اختر المنتج المطابق تماماً لهذه العبوة.
إذا كانت العبوة لمنتج غير موجود نهائياً بالقائمة أو الشك كبير جداً، اجعل matchedProductId قيمته null.
يجب أن يكون الرد عبارة عن كائن JSON فقط بالصيغة الدقيقة التالية:
{
  "matchedProductId": "<id المنتج المطابق أو null>",
  "confidence": 0.95,
  "detectedDetails": {
    "brand": "<الماركة المستخرجة من العبوة>",
    "targetAnimal": "<قطط أم كلاب>",
    "lifeStage": "<المرحلة العمرية كالبالغين أو الكيتن>",
    "flavor": "<النكهة المستخرجة كالدجاج والسلمون>",
    "productType": "<نوع الطعام كباتيه أو معلبات أو جاف أو مكافآت>",
    "weight": "<الوزن المطبوع كالـ 100 جم أو 400 جم>"
  },
  "reason": "<سبب المطابقة بالعربية بأسلوب واضح ومختصر>"
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: inlineData },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    },
  };

  const data = await callGeminiWithRotation(payload, 'gemini-2.5-flash');
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  try {
    const parsed = JSON.parse(rawText);
    return {
      matchedProductId: parsed.matchedProductId || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      detectedDetails: parsed.detectedDetails || null,
      reason: parsed.reason || 'تمت المطابقة البصرية.',
    };
  } catch (err) {
    console.error('Failed to parse Gemini Vision JSON response:', rawText);
    return {
      matchedProductId: null,
      confidence: 0,
      detectedDetails: null,
      reason: 'تعذر معالجة استجابة الذكاء الاصطناعي.',
    };
  }
}

/**
 * Batch match multiple images with concurrency control
 */
export async function batchMatchImages(images, candidateProducts, options = {}) {
  const { concurrency = 2, onProgress } = options;
  const results = [];
  const total = images.length;

  for (let i = 0; i < total; i += concurrency) {
    const chunk = images.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (item) => {
      try {
        const match = await matchImageToProducts(item.url, candidateProducts);
        return {
          mediaId: item.id,
          imageUrl: item.url,
          filename: item.filename || 'image',
          ...match,
        };
      } catch (err) {
        return {
          mediaId: item.id,
          imageUrl: item.url,
          filename: item.filename || 'image',
          matchedProductId: null,
          confidence: 0,
          detectedDetails: null,
          reason: `خطأ أثناء المعالجة: ${err.message}`,
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    if (onProgress) {
      onProgress(results.length, total);
    }
  }

  return results;
}
