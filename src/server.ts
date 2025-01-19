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

RegisterRoutes(app);

app.use((_, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
