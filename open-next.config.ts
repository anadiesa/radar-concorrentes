import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sem cache incremental persistente (R2) por enquanto: as páginas do Radar são dinâmicas
// (dependem do usuário logado), então não há o que pré-gerar.
export default defineCloudflareConfig({});
