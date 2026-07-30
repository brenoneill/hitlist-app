This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## OAuth on Vercel preview deployments

GitHub OAuth apps and GitHub Apps each accept exactly one callback/setup URL,
so previews route both flows through production:

- **Sign-in** uses Auth.js's built-in redirect proxy. In Vercel, set
  `AUTH_REDIRECT_PROXY_URL=https://<prod-domain>/api/auth` for the Production
  and Preview environments, and make sure `AUTH_SECRET`, `AUTH_GITHUB_ID`, and
  `AUTH_GITHUB_SECRET` are shared with Preview. The GitHub OAuth app's callback
  URL stays `https://<prod-domain>/api/auth/callback/github`.
- **App installs** pass the deployment's origin as `state`; the production
  Setup URL (`https://<prod-domain>/api/github/install/callback`) bounces the
  callback to that origin (https `*.vercel.app` only).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
