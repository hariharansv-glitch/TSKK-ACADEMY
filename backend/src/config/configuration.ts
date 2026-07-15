import type { EnvVars } from './env.validation';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  appUrl: string;
  apiUrl: string;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  url: string;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export interface QrConfig {
  hmacSecret: string;
}

export interface MinioConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  publicUrl: string;
  buckets: {
    photos: string;
    certificates: string;
    videos: string;
    documents: string;
  };
}

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
}

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export interface ThrottlerConfig {
  ttl: number;
  limit: number;
}

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  qr: QrConfig;
  minio: MinioConfig;
  mail: MailConfig;
  sms: SmsConfig;
  whatsapp: WhatsAppConfig;
  push: PushConfig;
  razorpay: RazorpayConfig;
  throttler: ThrottlerConfig;
}

export function buildConfig(env: EnvVars): RootConfig {
  return {
    app: {
      nodeEnv: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      port: env.BACKEND_PORT,
      apiPrefix: env.API_PREFIX,
      appUrl: env.APP_URL,
      apiUrl: env.API_URL,
      corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    },
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    qr: { hmacSecret: env.QR_HMAC_SECRET },
    minio: {
      endpoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
      publicUrl: env.MINIO_PUBLIC_URL,
      buckets: {
        photos: env.MINIO_BUCKET_PHOTOS,
        certificates: env.MINIO_BUCKET_CERTIFICATES,
        videos: env.MINIO_BUCKET_VIDEOS,
        documents: env.MINIO_BUCKET_DOCUMENTS,
      },
    },
    mail: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
    sms: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      fromNumber: env.TWILIO_FROM_NUMBER,
    },
    whatsapp: {
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    },
    push: {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    },
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    },
    throttler: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
  };
}
