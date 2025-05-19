var express = require("express");
var router = express.Router();
var Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const slugify = require("slugify");

const db = new Database("./data/data.db", {
  verbose: console.log,
});

/* Kontroll att Imagemapp existerar för att kunna lägga image filer som laddas upp där. */
if (!fs.existsSync("public/images")) {
  fs.mkdirSync("public/images");
}

/* spara undan bild samt sätta string för namnet på bilden och spara undan denna i databasen. rename med Timestamp för att undvika samma namn på bilder.  */

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
  const selectSpots = db.prepare("SELECT * FROM spots ");
  const spots = selectSpots.all();
  const selectHero = db.prepare("SELECT * FROM hero WHERE id = ?");
  const hero = selectHero.get(1);

  res.render("index", {
    title: "Freaky Friday",
    products,
    spots: spots.slice(0, 3),
    hero,
    slugify,
  });
});

// PRODUCT ROUTES

router.get("/products/:id/:slug", function (req, res, next) {
  const selectProduct = db.prepare("SELECT * FROM products WHERE id = ?");
  const product = selectProduct.get(req.params.id);

  if (!product) {
    return res.status(404).send("Product not found");
  }

  const correctSlug = slugify(product.name, { lower: true });

  if (req.params.slug !== correctSlug) {
    // Redirect till korrekt URL om slug är fel
    return res.redirect(`/products/${product.id}/${correctSlug}`);
  }

  const selectAllProducts = db.prepare("SELECT * FROM products");
  const allProducts = selectAllProducts.all();

  const now = new Date();

  const visibleProducts = allProducts.filter((p) => {
    const pubDate = new Date(p.publication_date);
    return !isNaN(pubDate) && pubDate <= now;
  });

  res.render("product", {
    title: product.name,
    product: product,
    products: visibleProducts,
    slugify,
  });
});

// KASSA ROUTES
router.get("/basket", function (req, res, next) {
  const selectProducts = db.prepare("SELECT * FROM products");
  const products = selectProducts.all();

  res.render("basket", {
    title: "Basket",
    products: products,
  });
});

router.get("/checkout", function (req, res, next) {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render("checkout", { title: "Checkout", cart, total });
});

// ADMIN ROUTES
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

router.post("/admin/delete/:id", (req, res, next) => {
  try {
    const deleteProduct = db.prepare("DELETE FROM products WHERE id = ?");
    const info = deleteProduct.run(req.params.id);

    if (info.changes === 0) {
      return res.status(404).json({ error: "Product not found" }); // Product ej hittad
    }

    res.redirect("/admin/products"); // Redirect efter delete
  } catch (err) {
    next(err); // Hantera eventuella fel
  }
});

router.post("/admin/new", upload.single("picture"), function (req, res, next) {
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

// Cart
router.get("/cart", (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render("cart", { cart, total });
});

// Add to cart
router.post("/add-to-cart", (req, res) => {
  const { id } = req.body;
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);

  if (!product) return res.status(404).send("Product not found");

  if (!req.session.cart) req.session.cart = [];

  const cart = req.session.cart;
  const existingItem = cart.find((item) => item.id === product.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  // Redirect back to previous page
  res.redirect("back");
});

// Uppdatera qty cart
router.post("/cart/update", (req, res) => {
  const cart = req.session.cart || [];
  const { id, quantity } = req.body;

  const itemId = parseInt(id);
  const newQty = parseInt(quantity);

  if (isNaN(itemId) || isNaN(newQty) || newQty < 1) {
    return res.status(400).json({ error: "Invalid ID or quantity" });
  }

  req.session.cart = cart.map((item) =>
    item.id === itemId ? { ...item, quantity: newQty } : item
  );

  res.json({ success: true });
});

// ta bort vara från cart
router.post("/cart/remove", (req, res) => {
  const cart = req.session.cart || [];
  const { id } = req.body;

  const itemId = parseInt(id);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  req.session.cart = cart.filter((item) => item.id !== itemId);

  res.json({ success: true });
});

// Checkout

router.get("/checkout", (req, res) => {
  const cart = req.session.cart || [];

  const total = cart.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  res.render("checkout", { cart, total });
});

router.post("/checkout", (req, res) => {
  const cart = req.session.cart || [];

  // Beräkna totalen
  const total = cart.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  // Omvandla varukorgen till en JSON-sträng
  const cartJson = JSON.stringify(cart);

  // Skapa en ny order
  const stmt = db.prepare(`
    INSERT INTO orders (firstname, lastname, email, street, postal, city, cart, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    req.body.firstname,
    req.body.lastname,
    req.body.email,
    req.body.street,
    req.body.postal,
    req.body.city,
    cartJson, // JSON-sträng med produkter
    total // Totalbeloppet för ordern
  );

  const orderId = result.lastInsertRowid;

  // Spara varje varukorgsobjekt i order_items-tabellen
  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_name, product_price, quantity, total)
    VALUES (?, ?, ?, ?, ?)
  `);

  cart.forEach((item) => {
    insertItemStmt.run(
      orderId, // Relatera till den nyss skapade ordern
      item.name,
      item.price,
      item.quantity,
      item.price * item.quantity
    );
  });

  // Ta bort varukorgen från sessionen
  req.session.cart = [];

  // Skicka vidare till bekräftelsesidan
  res.redirect(`/confirmation?id=${orderId}`);
});

// Hämta orderkonfirmationsida
router.get("/confirmation", (req, res) => {
  const orderId = req.query.id;

  // Hämta orderdetaljer
  const orderStmt = db.prepare("SELECT * FROM orders WHERE id = ?");
  const order = orderStmt.get(orderId);

  if (!order) {
    return res.status(404).send("Order not found.");
  }

  // Omvandla varukorgen från JSON till ett objekt
  let cart = [];
  try {
    cart = JSON.parse(order.cart);
  } catch (err) {
    return res.status(500).send("Kunde inte tolka varukorgen.");
  }

  // Hämta produkterna i ordern
  const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  const items = itemsStmt.all(orderId);

  // Rendera tacksidan
  res.render("confirmation", { order, items, cart });
});

// Sökfunktion och söksida söker på namn och beskrivning
router.get("/search", (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.render("search", { products: [], query: "" });
  }

  const stmt = db.prepare(`
    SELECT * FROM products
    WHERE name LIKE ?
  `);

  // WHERE name LIKE ? OR description LIKE ? för att söka på namn eller beskrivning

  const wildcard = `%${query}%`;
  const products = stmt.all(wildcard);

  res.render("search", { products, query, slugify });
});

module.exports = router;
