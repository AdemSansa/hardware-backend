const Product = require("./product.schema");

const buildErrorResponse = (res, error, message = "Internal server error") => {
  console.error(`[ProductController] ${message}:`, error);
  return res.status(500).json({ message });
};

const create = async (req, res) => {
  try {
    const { name, sku, description, category, price, stock, isActive } = req.body;
    const product = await Product.create({
      name,
      sku,
      description,
      category,
      price,
      stock,
      isActive,
    });
    return res.status(201).json(product);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Product with this SKU already exists" });
    }
    return buildErrorResponse(res, error);
  }
};

const getAll = async (_req, res) => {
  try {
    const products = await Product.find().sort({ updatedAt: -1 });
    return res.status(200).json(products);
  } catch (error) {
    return buildErrorResponse(res, error);
  }
};

const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json(product);
  } catch (error) {
    return buildErrorResponse(res, error, "Unable to fetch product");
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json(product);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Product with this SKU already exists" });
    }
    return buildErrorResponse(res, error, "Unable to update product");
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return buildErrorResponse(res, error, "Unable to delete product");
  }
};

module.exports = { create, getAll, getOne, update, remove };

