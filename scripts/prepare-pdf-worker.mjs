import { copyFileSync } from "node:fs";
copyFileSync(new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url),new URL("../public/pdf.worker.min.mjs",import.meta.url));
