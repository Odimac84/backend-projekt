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

module.exports = router;
