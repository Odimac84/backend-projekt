var express = require("express");
var router = express.Router();
var Database = require("better-sqlite3");

const db = new Database("./data/data.db", {
  verbose: console.log,
});

/* GET home page. */
router.get("/", function (req, res, next) {
  const selectProducts = db.prepare("SELECT * FROM products");
  const products = selectProducts.all();

  res.render("index", {
    title: "Freaky Friday",
    products: products,
  });
});

router.get("/products/:id", function (req, res, next) {
  const selectProduct = db.prepare("SELECT * FROM products WHERE id = ?");
  const product = selectProduct.get(req.params.id);

  if (!product) {
    return res.status(404).send("Product not found");
  }

  res.render("product", {
    title: product.name,
    product: product,
  });
});

module.exports = router;
