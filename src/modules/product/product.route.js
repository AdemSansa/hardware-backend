const express = require("express");
const { create, getAll, getOne, update, remove } = require("./product.controller");

const productRoutes = express.Router();

productRoutes.post("/", create);
productRoutes.get("/", getAll);
productRoutes.get("/:id", getOne);
productRoutes.put("/:id", update);
productRoutes.delete("/:id", remove);

module.exports = productRoutes;

