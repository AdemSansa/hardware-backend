const Product = require("./product.schema");
const sampleProducts = require("./sampleProducts");

async function seedProducts() {
  try {
    const existingCount = await Product.countDocuments();
    if (existingCount > 0) {
      return;
    }
    await Product.insertMany(sampleProducts);
    console.log(`Seeded ${sampleProducts.length} sample products.`);
  } catch (error) {
    console.error("Failed to seed products:", error);
  }
}

module.exports = { seedProducts };

