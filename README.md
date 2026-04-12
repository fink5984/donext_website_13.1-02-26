This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Auto-Deploy
This project automatically deploys to Railway on every push to main branch.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Public file storage (AWS S3)

Add these to `.env.local`:

```
# Required
AWS_REGION=eu-central-1
AWS_S3_BUCKET=your-public-bucket

# Optional (for custom endpoints like MinIO)
AWS_S3_ENDPOINT=
AWS_S3_FORCE_PATH_STYLE=false

# Credentials (when not using IAM role on server)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Optional explicit public URL base (overrides default S3 URL building)
AWS_S3_PUBLIC_BASE_URL=https://your-public-bucket.s3.eu-central-1.amazonaws.com

# If your bucket still uses ACLs and you want to set public-read on upload
AWS_S3_ACL_PUBLIC_READ=false
```

API routes:

- POST `/api/storage` (multipart/form-data)
  - fields: `file` (required), optional: `campaignId`, `prefix`, `filename`, `cacheControl`
  - response: `{ success, data: { key, url }, error }`

- DELETE `/api/storage`
  - body: `{ key: string }` or `{ keys: string[] }`
  - response: `{ success, data: { deleted, errors? }, error }`

All inputs are validated with Zod and responses are unified.