const express = require("express");
const { authenticate } = require("../../middleware/authMiddleware");

const { create, getAll, getOne, update, remove, heartbeat } = require("./user.controller.js");
const userRoutes = express.Router();
userRoutes.post("/",  create);
userRoutes.get("/",  getAll);
userRoutes.get("/:id",  getOne);
userRoutes.put("/:id",  update);
userRoutes.delete("/:id",  remove);
userRoutes.post("/heartbeat", authenticate, heartbeat);


module.exports = userRoutes;