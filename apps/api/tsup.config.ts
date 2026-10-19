import { defineConfig } from 'tsup';
export default defineConfig({ noExternal: [/^@pengtou\//], clean: true });
