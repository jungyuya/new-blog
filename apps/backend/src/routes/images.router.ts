import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { cookieAuthMiddleware, adminOnlyMiddleware } from '../middlewares/auth.middleware';
import type { AppEnv } from '../lib/types';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

const imagesRouter = new Hono<AppEnv>();

// S3 클라이언트는 이 라우터 내에서만 사용됩니다.
const s3 = new S3Client({ region: process.env.REGION });
const BUCKET_NAME = process.env.IMAGE_BUCKET_NAME!;

// 쿼리 파라미터 유효성 검사를 위한 Zod 스키마
const PresignedUrlQuerySchema = z.object({
    fileName: z.string().min(1, 'fileName is required.'),
});

// --- [1] GET /presigned-url - 이미지 업로드를 위한 Presigned URL 발급 ---
imagesRouter.get(
    '/presigned-url',
    cookieAuthMiddleware,
    adminOnlyMiddleware,
    zValidator('query', PresignedUrlQuerySchema),
    async (c) => {
        try {
            const { fileName } = c.req.valid('query');

            const extension = path.extname(fileName).toLowerCase();
            const uniqueFileNameWithoutExt = uuidv4();

            // [핵심 수정] 최종 파일 확장자를 결정합니다.
            const finalExtension = extension === '.gif' ? '.gif' : '.webp';
            const finalFileName = `${uniqueFileNameWithoutExt}${finalExtension}`;

            const key = `uploads/${uniqueFileNameWithoutExt}${extension}`; // 원본 확장자로 업로드

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });

            const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

            // [핵심 수정] publicUrl을 생성할 때, 동적으로 결정된 최종 파일 이름을 사용합니다.
            const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/images/${finalFileName}`;

            return c.json({
                presignedUrl,
                key,
                publicUrl,
            });

        } catch (error) {
            console.error('Error creating presigned URL:', error);
            return c.json({ message: 'Failed to create presigned URL' }, 500);
        }
    }
);
export default imagesRouter;