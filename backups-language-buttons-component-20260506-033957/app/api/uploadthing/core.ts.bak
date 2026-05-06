import { createUploadthing, type FileRouter } from 'uploadthing/next';
import jwt from 'jsonwebtoken';

const f = createUploadthing();
const SECRET = process.env.JWT_SECRET || 'change-this-secret';

export const ourFileRouter = {
  receiptUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const authHeader = req.headers.get('authorization');
      const bearerToken = authHeader?.replace('Bearer ', '');

      const cookieToken = req.headers
        .get('cookie')
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('token='))
        ?.replace('token=', '');

      const token = bearerToken || cookieToken;

      if (!token) throw new Error('Unauthorized');

      const user = jwt.verify(token, SECRET) as any;

      return {
        userId: user.userId || user.id,
        phone: user.phone,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        phone: metadata.phone,
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
