// 파일 위치: image-processor-service/src/index.ts
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { S3Event, S3Handler } from 'aws-lambda';
import sharp from 'sharp';
import * as path from 'path';

// S3 클라이언트를 핸들러 외부에서 초기화하여 재사용합니다 (Lambda 성능 최적화).
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });

/**
 * S3 'ObjectCreated' 이벤트에 의해 트리거되는 Lambda 핸들러입니다.
 * 'uploads/' 폴더에 업로드된 이미지를 리사이징하여 'images/'와 'thumbnails/' 폴더에 저장하고,
 * 원본 이미지를 삭제합니다.
 */
export const handler: S3Handler = async (event: S3Event): Promise<void> => {
  console.log('Lambda triggered with event:', JSON.stringify(event, null, 2));

  // S3 이벤트는 여러 개의 레코드를 포함할 수 있으므로, Promise.all로 병렬 처리합니다.
  await Promise.all(
    event.Records.map(async (record) => {
      // 1. 이벤트 정보에서 버킷 이름과 객체(이미지 파일) 키를 추출합니다.
      const sourceBucket = record.s3.bucket.name;
      const sourceKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`Processing image: s3://${sourceBucket}/${sourceKey}`);

      // [안전장치] 무한 루프 방지를 위해 'uploads/' 폴더에 있는 파일만 처리합니다.
      if (!sourceKey.startsWith('uploads/')) {
        console.log(`Skipping file as it is not in the 'uploads/' directory.`);
        return;
      }

      try {
        // 2. S3에서 원본 이미지 파일을 Buffer 형태로 가져옵니다.
        const getObjectCommand = new GetObjectCommand({ Bucket: sourceBucket, Key: sourceKey });
        const getObjectResponse = await s3.send(getObjectCommand);
        const imageBufferArray = await getObjectResponse.Body?.transformToByteArray();

        if (!imageBufferArray) {
          throw new Error('Failed to get image buffer from S3 object.');
        }
        const imageBuffer = Buffer.from(imageBufferArray);

        // 3. 일반용 이미지와 섬네일용 이미지 생성을 병렬로 처리합니다.
        await Promise.all([
          resizeAndUpload(imageBuffer, sourceBucket, sourceKey, 'images', 1200),
          resizeAndUpload(imageBuffer, sourceBucket, sourceKey, 'thumbnails', 300),
        ]);

        // 4. 모든 리사이징이 성공하면, 원본 이미지를 삭제합니다.
        const deleteObjectCommand = new DeleteObjectCommand({ Bucket: sourceBucket, Key: sourceKey });
        await s3.send(deleteObjectCommand);

        console.log(`Successfully processed and deleted original image: ${sourceKey}`);

      } catch (error) {
        console.error(`Error processing image ${sourceKey}:`, error);
        throw error; // 실패 시 에러를 던져 Lambda 실행이 실패했음을 알립니다.
      }
    })
  );
};

/**
 * 이미지를 리사이징하고 지정된 S3 경로에 업로드하는 헬퍼 함수
 */
async function resizeAndUpload(
  buffer: Buffer,
  bucket: string,
  originalKey: string,
  targetFolder: 'images' | 'thumbnails',
  maxWidth: number
): Promise<void> {
  const fileName = originalKey.substring(originalKey.indexOf('/') + 1);
  // 확장자를 webp로 변경합니다.
  const newFileName = `${path.parse(fileName).name}.webp`;
  const targetKey = `${targetFolder}/${newFileName}`;

  const resizedBuffer = await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const putObjectCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: targetKey,
    Body: resizedBuffer,
    ContentType: 'image/webp',
  });

  await s3.send(putObjectCommand);
  console.log(`Uploaded resized image to: s3://${bucket}/${targetKey}`);
}

