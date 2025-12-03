import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    prerender: {
      crawl: false, // don't try to prerender pages automatically
    }
  }
};
