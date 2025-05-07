var express = require("express");
var router = express.Router();
var Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = new Database("./data/data.db", {
  verbose: console.log,
});

if (!fs.existsSync("public/images")) {
  fs.mkdirSync("public/images");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/images"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

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

router.get("/basket", function (req, res, next) {
  const selectProducts = db.prepare("SELECT * FROM products");
  const products = selectProducts.all();

  res.render("basket", {
    title: "Basket",
    products: products,
  });
});

router.get("/checkout", function (req, res, next) {
  const selectProducts = db.prepare("SELECT * FROM products");
  const products = selectProducts.all();

  res.render("checkout", {
    title: "Checkout",
    products: products,
  });
});

router.get("/admin/products", function (req, res, next) {
  const selectProducts = db.prepare("SELECT * FROM products");
  const products = selectProducts.all();

  res.render("admin", {
    title: "Admin - Products",
    products: products,
  });
});

router.get("/admin/new", function (req, res, next) {
  res.render("new", {
    title: "Admin - New Product",
  });
});

router.post("/admin/new", upload.single("picture"), function (req, res, next) {
  console.log("BODY:", req.body); // <== payloadkoll
  console.log("FILE:", req.file); // <== Bildkoll

  if (!req.file) {
    return res.status(400).send("Ingen fil mottagen");
  }

  // lägga till produkt i databasen
  const insertProduct = db.prepare(
    "INSERT INTO products (name, description, price, picture, brand, SKU, publication_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const info = insertProduct.run(
    req.body.name,
    req.body.description,
    req.body.price,
    req.file.filename,
    req.body.brand || "",
    req.body.SKU,
    req.body.publication_date
  );

  res.redirect("/admin/products");
});

module.exports = router;
