import mongoose from "mongoose";

const inventoryEventSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    type: {
      type: String,
      enum: ["IN", "OUT", "ADJUST"],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"]
    },
    reason: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("InventoryEvent", inventoryEventSchema);
