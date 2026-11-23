import { app } from "./app.js";
import { config } from "./config/env.js";

app.listen(config.port, () => {
  console.info(`Stock Slice API listening on http://localhost:${config.port}`);
  console.info(`Share precision: ${config.sharePrecision} decimal places`);
});
