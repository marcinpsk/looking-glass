import adapter from '@sveltejs/adapter-static';

// vite.config.ts passes this to sveltekit(); eslint.config.js gives it to the Svelte parser.
/** @type {import('@sveltejs/kit/vite').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	adapter: adapter({
		pages: '../cmd/server/dist',
		assets: '../cmd/server/dist',
		fallback: 'index.html',
		precompress: false,
		strict: false
	})
};

export default config;
