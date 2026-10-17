import { v2 as cloudinary } from 'cloudinary';

function configuredCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are not configured.');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function safeFolderPart(value) {
  return String(value || 'general').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'general';
}

export async function uploadImage(file, folder = 'catalog') {
  const result = await uploadImageDetailed(file, folder);
  return result.url;
}

export async function uploadImageDetailed(file, folder = 'catalog') {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    throw new Error('Please upload a valid image file.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image size must be 10 MB or less.');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const destination = 'catfood-studio/' + safeFolderPart(folder);
  const client = configuredCloudinary();
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: destination,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: Number(result.bytes || file.size || 0),
          width: Number(result.width || 0),
          height: Number(result.height || 0),
          format: String(result.format || file.type.split('/')[1] || 'webp'),
          originalFilename: String(file.name || 'image'),
        });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteImage(identifier) {
  if (!identifier || typeof identifier !== 'string') return false;
  try {
    let publicId = identifier.trim();
    if (publicId.includes('res.cloudinary.com')) {
      const match = publicId.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
      if (match) publicId = match[1];
    }
    const client = configuredCloudinary();
    const res = await client.uploader.destroy(publicId);
    return res.result === 'ok' || res.result === 'not found';
  } catch (err) {
    console.error('Failed to delete Cloudinary image:', err);
    throw err;
  }
}
