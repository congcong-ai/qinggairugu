import { defineConfig } from 'tsup';
export default defineConfig({ noExternal: [/^@qinggairugu\//], clean: true });
