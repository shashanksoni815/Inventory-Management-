import express from "express";
import cors from "cors";
import inventoryRoutes from "./routes/inventory.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", inventoryRoutes);

export default app;
