import { loader } from '@monaco-editor/react';

if (typeof window !== 'undefined') {
  loader.config({
    paths: {
      vs: '/monaco/vs',
    },
  });
}

export { loader };
