import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputDirectory = resolve("dist/ricosabor-tienda/browser");
const indexPath = resolve(outputDirectory, "index.html");

if (!existsSync(indexPath)) {
  throw new Error(`No se encontró el build Angular en ${indexPath}`);
}

let index = readFileSync(indexPath, "utf8");
index = index.replace(
  /<meta name="robots" content="[^"]*"\s*\/?\s*>/i,
  '<meta name="robots" content="noindex,nofollow,noarchive" />'
);
index = index.replace(
  "</head>",
  `  <style id="staging-environment-style">
      .staging-environment-badge {
        position: fixed;
        inset: auto auto 8px 8px;
        z-index: 2147483647;
        padding: 3px 7px;
        border-radius: 5px;
        background: rgba(111, 26, 26, .92);
        color: #fff;
        font: 700 10px/1.2 Arial, sans-serif;
        letter-spacing: .08em;
        pointer-events: none;
      }
    </style>
  </head>`
);
index = index.replace(
  "</body>",
  '    <div class="staging-environment-badge" role="status" aria-label="Entorno de pruebas">STAGING</div>\n  </body>'
);

writeFileSync(indexPath, index, "utf8");
writeFileSync(
  resolve(outputDirectory, "robots.txt"),
  "User-agent: *\nDisallow: /\n",
  "utf8"
);
writeFileSync(
  resolve(outputDirectory, "_headers"),
  "/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n",
  "utf8"
);

console.log("Artefacto staging preparado: noindex, robots bloqueado, X-Robots-Tag y badge STAGING.");
