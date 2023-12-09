import { defineConfig } from 'vite';

export default defineConfig({
  root: './src',
  assetsInclude:["src/assets/**/*"],
  build: {
    outDir: '../dist',
    minify: false,
    emptyOutDir: true,
  },
});
