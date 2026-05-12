/// <reference types="vite/client" />

import type { SnippetFlowApi } from "../electron/preload";

declare global {
  interface Window {
    snippetFlow?: SnippetFlowApi;
  }
}
