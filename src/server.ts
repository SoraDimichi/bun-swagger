import express from "express";
import swaggerUi from "swagger-ui-express";
import { RegisterRoutes } from "./routes/routes";
import swaggerDoc from "./swagger.json";

const app = express();

app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
RegisterRoutes(app);

app.use((_, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
