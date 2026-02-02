import { Router } from "express";
import { adjustInventory, createProduct, deleteProduct, getInventoryEvents, getLowStockProducts, getProducts, getStockByProduct, stockIn, stockOut, updateProduct } from "../controllers/Inventory.controller.js";


const router = Router();

// Products
router.post("/products", createProduct);
router.get("/products", getProducts);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Inventory
router.post("/inventory/in", stockIn);
router.post("/inventory/out", stockOut);
router.get("/inventory/:productId/stock", getStockByProduct);
router.get("/inventory/events", getInventoryEvents);
router.get("/inventory/low-stock", getLowStockProducts);
router.post("/inventory/adjust", adjustInventory);

export default router;
