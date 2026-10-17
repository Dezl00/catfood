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
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    throw new Error('Please upload a valid image file.');
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error('Image size must be 6 MB or less.');
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
      (error, result) => error ? reject(error) : resolve(result.secure_url),
    );
    stream.end(buffer);
  });
}

export async function deleteImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.includes('res.cloudinary.com')) return;
  try {
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
    if (!match) return;
    const publicId = match[1];
    const client = configuredCloudinary();
    await client.uploader.destroy(publicId);
  } catch (err) {
    console.error('Failed to delete Cloudinary image:', err);
  }
}
