// 파일 위치: image-processor-service/src/index.ts (v1.1 - EventBridge 호환 최종본)
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// [수정] S3Event 대신, EventBridge 이벤트를 처리하기 위한 타입을 import 합니다.
import type { EventBridgeEvent, Handler } from 'aws-lambda';
import sharp from 'sharp';
import * as path from 'path';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });

// [수정] S3 'Object Created' 이벤트의 detail 타입을 정의합니다.
interface S3ObjectCreatedDetail {
  bucket: {
    name: string;
  };
  object: {
    key: string;
  };
}

// [수정] 핸들러의 타입을 EventBridge 이벤트에 맞게 변경합니다.
export const handler: Handler<EventBridgeEvent<'Object Created', S3ObjectCreatedDetail>> = async (event) => {
  console.log('Lambda triggered with event:', JSON.stringify(event, null, 2));

  // [수정] EventBridge 이벤트는 단일 이벤트를 전달하므로, Records.map 루프가 필요 없습니다.
  // 1. 이벤트의 'detail' 객체에서 버킷 이름과 객체 키를 추출합니다.
  const sourceBucket = event.detail.bucket.name;
  const sourceKey = decodeURIComponent(event.detail.object.key.replace(/\+/g, ' '));

  console.log(`Processing image: s3://${sourceBucket}/${sourceKey}`);

  if (!sourceKey.startsWith('uploads/')) {
    console.log(`Skipping file as it is not in the 'uploads/' directory.`);
    return; // map이 아니므로 return으로 함수를 종료합니다.
  }

  try {
    // 2. S3에서 원본 이미지 파일을 가져오는 로직 (이전과 동일)
    const getObjectCommand = new GetObjectCommand({ Bucket: sourceBucket, Key: sourceKey });
    const getObjectResponse = await s3.send(getObjectCommand);
    const imageBufferArray = await getObjectResponse.Body?.transformToByteArray();
    if (!imageBufferArray) throw new Error('Failed to get image buffer from S3 object.');
    const imageBuffer = Buffer.from(imageBufferArray);

    // 3. 이미지 리사이징을 병렬로 처리하는 로직 (이전과 동일)
    await Promise.all([
      resizeAndUpload(imageBuffer, sourceBucket, sourceKey, 'images', 1200),
      resizeAndUpload(imageBuffer, sourceBucket, sourceKey, 'thumbnails', 300),
    ]);

    // 4. 원본 이미지를 삭제하는 로직 (이전과 동일)
    const deleteObjectCommand = new DeleteObjectCommand({ Bucket: sourceBucket, Key: sourceKey });
    await s3.send(deleteObjectCommand);

    console.log(`Successfully processed and deleted original image: ${sourceKey}`);

  } catch (error) {
    console.error(`Error processing image ${sourceKey}:`, error);
    throw error;
  }
};

/**
 * 이미지를 리사이징하고 지정된 S3 경로에 업로드하는 헬퍼 함수
 * [v1.1] GIF 파일은 WebP로 변환하지 않고 원본 포맷을 유지하도록 수정
 */
async function resizeAndUpload(
  buffer: Buffer,
  bucket: string,
  originalKey: string,
  targetFolder: 'images' | 'thumbnails',
  maxWidth: number
): Promise<{ targetKey: string }> { // [수정] 반환 값에 targetKey를 포함
  const originalFileName = originalKey.substring(originalKey.indexOf('/') + 1);
  const fileExtension = path.extname(originalFileName).toLowerCase();
  const fileNameWithoutExt = path.parse(originalFileName).name;

  let processedBuffer: Buffer;
  let targetKey: string;
  let contentType: string;

  // [핵심] 파일 확장자가 .gif인 경우, 별도로 처리합니다.
  if (fileExtension === '.gif') {
    console.log(`Processing as GIF: ${originalFileName}`);
    // GIF는 애니메이션을 유지하기 위해 리사이징만 수행하고 포맷은 변경하지 않습니다.
    processedBuffer = await sharp(buffer, { animated: true })
      .resize({ width: maxWidth, withoutEnlargement: true })
      .toBuffer();

    targetKey = `${targetFolder}/${fileNameWithoutExt}.gif`;
    contentType = 'image/gif';
  } else {
    console.log(`Processing as standard image (to WebP): ${originalFileName}`);
    // GIF가 아닌 다른 이미지들은 WebP로 변환하여 최적화합니다.
    processedBuffer = await sharp(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    targetKey = `${targetFolder}/${fileNameWithoutExt}.webp`;
    contentType = 'image/webp';
  }

  const putObjectCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: targetKey,
    Body: processedBuffer,
    ContentType: contentType,
  });

  await s3.send(putObjectCommand);
  console.log(`Uploaded processed image to: s3://${bucket}/${targetKey}`);

  // [추가] 생성된 파일의 키를 반환합니다. (향후 확장을 위해)
  return { targetKey };
}
