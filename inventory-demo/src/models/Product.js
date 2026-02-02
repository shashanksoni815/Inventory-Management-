import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    unit: { type: String, required: true }, // kg, pcs, liters
    reorderLevel: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
