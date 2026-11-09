import { defineEnvVars } from '@sveltejs/kit/env';

// The Go server writes these to /_app/env.js (pkg/http/webui/webui.go); #lib/env.js fills in the ones it leaves out.
const fromServer = { public: true, schema: (value: string | undefined) => value };

export const variables = defineEnvVars({
	PUBLIC_PAGE_TITLE: fromServer,
	PUBLIC_HEADER_TEXT: fromServer,
	PUBLIC_HEADER_LINKS: { ...fromServer, description: 'Comma-separated `name|href` pairs.' },
	PUBLIC_HEADER_LOGO: fromServer,
	PUBLIC_FOOTER_TEXT: fromServer,
	PUBLIC_FOOTER_LINKS: { ...fromServer, description: 'Comma-separated `name|href` pairs.' },
	PUBLIC_FOOTER_LOGO: fromServer,
	PUBLIC_GRPC_URL: fromServer,
	PUBLIC_LG_VERSION: fromServer,
	PUBLIC_SENTRY_DSN: fromServer,
	PUBLIC_SENTRY_ENV: fromServer,
	PUBLIC_SENTRY_SAMPLE_RATE: fromServer
});
