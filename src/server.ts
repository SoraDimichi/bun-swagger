import express from "express";
import { readFileSync } from "fs";
import { join } from "path";
import cors from "cors";
import { RegisterRoutes } from "./routes/routes";

const swaggerSpecPath = join(__dirname, "swagger.json");
const swaggerSpec = JSON.parse(readFileSync(swaggerSpecPath, "utf-8"));

const app = express();

app.use(cors());
app.use(express.json());
app.get("/swagger.json", (_, res) => {
  res.status(200).json(swaggerSpec);
});

app.get("/docs", (req, res) => {
  const swaggerUiHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Swagger UI</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css"/>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
      <script>
        SwaggerUIBundle({ url: '/swagger.json', dom_id: '#swagger-ui' })
      </script>
    </body>
    </html>
  `;
  res.status(200).send(swaggerUiHtml);
});

RegisterRoutes(app);

app.use((_, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
