import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUploadUrl {
  uploadUrl: string;
  expiresAt: Date;
}

export interface PresignedDownloadUrl {
  downloadUrl: string;
  expiresAt: Date;
}

@Injectable()
export class S3StorageClient implements OnModuleInit {
  private readonly logger = new Logger(S3StorageClient.name);
  private client!: S3Client;
  private bucket!: string;
  private defaultTtl!: number;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT_URL');
    const region = this.config.getOrThrow<string>('S3_REGION');
    const accessKeyId = this.config.getOrThrow<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.getOrThrow<string>('S3_SECRET_ACCESS_KEY');
    const forcePathStyle = this.config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE');
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.defaultTtl = this.config.getOrThrow<number>('S3_PRESIGN_TTL_SECONDS');

    const s3Config: S3ClientConfig = {
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
      // AWS SDK v3 (>=3.729) bakes a default CRC32 checksum into presigned PUT
      // URLs (`x-amz-checksum-crc32` + `x-amz-sdk-checksum-algorithm`). A plain
      // byte upload from the mobile client can't reproduce that signed header,
      // so MinIO rejects it (SignatureDoesNotMatch / checksum mismatch). Only
      // add checksums when an operation actually requires one — restores classic
      // presigned uploads that any HTTP client can PUT to.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    if (endpoint) s3Config.endpoint = endpoint;
    this.client = new S3Client(s3Config);
    this.logger.log(
      `S3 client ready (bucket=${this.bucket}, endpoint=${endpoint || 'AWS default'})`,
    );
  }

  async getPresignedPutUrl(
    key: string,
    contentType: string,
    ttlSec?: number,
  ): Promise<PresignedUploadUrl> {
    const ttl = ttlSec ?? this.defaultTtl;
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: ttl });
    return { uploadUrl, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  async getPresignedGetUrl(key: string, ttlSec?: number): Promise<PresignedDownloadUrl> {
    const ttl = ttlSec ?? this.defaultTtl;
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const downloadUrl = await getSignedUrl(this.client, cmd, { expiresIn: ttl });
    return { downloadUrl, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  async headObject(
    key: string,
  ): Promise<{ exists: boolean; sizeBytes?: number; mimeType?: string }> {
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { exists: true, sizeBytes: out.ContentLength, mimeType: out.ContentType };
    } catch (err) {
      const code = (err as { $metadata?: { httpStatusCode?: number }; name?: string }).$metadata
        ?.httpStatusCode;
      if (code === 404 || (err as { name?: string }).name === 'NotFound') return { exists: false };
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
