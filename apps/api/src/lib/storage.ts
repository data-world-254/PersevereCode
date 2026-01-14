import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const env = z
  .object({
    STORAGE_PROVIDER: z.enum(["spaces", "s3"]).default("spaces"),
    SPACES_ENDPOINT: z.string().url().optional(), // e.g., https://nyc3.digitaloceanspaces.com
    SPACES_REGION: z.string().default("us-east-1"),
    SPACES_ACCESS_KEY_ID: z.string().optional(),
    SPACES_SECRET_ACCESS_KEY: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().min(1),
    STORAGE_BASE_URL: z.string().url().optional(), // Public base URL if bucket is public
  })
  .parse(process.env);

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const isSpaces = env.STORAGE_PROVIDER === "spaces";
    const endpoint = isSpaces ? env.SPACES_ENDPOINT : undefined;
    const region = isSpaces ? env.SPACES_REGION : env.S3_REGION || "us-east-1";
    const accessKeyId = isSpaces ? env.SPACES_ACCESS_KEY_ID : env.S3_ACCESS_KEY_ID;
    const secretAccessKey = isSpaces ? env.SPACES_SECRET_ACCESS_KEY : env.S3_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(`Missing storage credentials for ${env.STORAGE_PROVIDER}`);
    }

    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: isSpaces, // Spaces requires path-style URLs
    });
  }
  return s3Client;
}

export interface UploadResult {
  path: string;
  url?: string; // Public URL if available
  size: number;
}

export async function uploadArtifact(
  jobId: string,
  artifactType: string,
  filename: string,
  content: Buffer | string,
  contentType?: string
): Promise<UploadResult> {
  const client = getS3Client();
  const contentBuffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  const path = `jobs/${jobId}/${artifactType}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: env.STORAGE_BUCKET,
    Key: path,
    Body: contentBuffer,
    ContentType: contentType || "application/octet-stream",
    ACL: "private", // Keep private, use signed URLs for access
  });

  await client.send(command);

  let url: string | undefined;
  if (env.STORAGE_BASE_URL) {
    url = `${env.STORAGE_BASE_URL.replace(/\/+$/, "")}/${path}`;
  }

  return {
    path,
    url,
    size: contentBuffer.length,
  };
}

export async function getArtifactSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: env.STORAGE_BUCKET,
    Key: path,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteArtifact(path: string): Promise<void> {
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: env.STORAGE_BUCKET,
    Key: path,
  });

  await client.send(command);
}

