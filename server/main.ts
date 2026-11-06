import { fileURLToPath } from "node:url";
import { createPortalServer } from "./http.ts";

const host = "127.0.0.1";
const port = 4176;

try {
  const server = await createPortalServer({
    dataDir: fileURLToPath(new URL("../.portal-data.local/", import.meta.url)),
    distDir: fileURLToPath(new URL("../dist-portal/", import.meta.url)),
  });
  server.once("error", (error) => {
    console.error("Le portail n’a pas démarré :", error.message);
    process.exitCode = 1;
  });
  server.listen(port, host, () => console.log("Portail : http://" + host + ":" + port + "/portal/"));
} catch (error) {
  console.error("Le portail n’a pas démarré :", error instanceof Error ? error.message : "erreur inconnue");
  process.exitCode = 1;
}
