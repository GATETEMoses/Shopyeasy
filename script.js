/* ============ CONFIG (customise here) ============ */
const CONFIG = {
  currency: "USD",
  locale: "en-EN",
  storageKey: "shopeasy_cart"
};


const PRODUCTS = [
  { id: 1,  name: "Wireless Headphones", category: "Electronics", price: 45000, emoji: "🎧", description: "Bluetooth over-ear headphones with deep bass." },
  { id: 2,  name: "Smart Watch",         category: "Electronics", price: 85000, emoji: "⌚", description: "Track fitness, sleep and notifications." },
  { id: 3,  name: "Phone Power Bank",    category: "Electronics", price: 22000, emoji: "🔋", description: "10,000mAh fast-charging portable battery." },
  { id: 4,  name: "Running Shoes",       category: "Fashion",     price: 38000, emoji: "👟", description: "Lightweight, breathable and comfortable." },
  { id: 5,  name: "Denim Jacket",        category: "Fashion",     price: 32000, emoji: "🧥", description: "Classic fit jacket for every season." },
  { id: 6,  name: "Backpack",            category: "Fashion",     price: 27000, emoji: "🎒", description: "Water-resistant with laptop compartment." },
  { id: 7,  name: "Coffee Maker",        category: "Home",        price: 52000, emoji: "☕", description: "Brew fresh coffee in minutes." },
  { id: 8,  name: "Table Lamp",          category: "Home",        price: 15000, emoji: "💡", description: "Warm LED lamp with adjustable brightness." },
  { id: 9,  name: "Cooking Pot Set",     category: "Home",        price: 48000, emoji: "🍲", description: "Non-stick 5-piece set for your kitchen." },
  { id: 10, name: "Yoga Mat",            category: "Sports",      price: 18000, emoji: "🧘", description: "Non-slip, extra thick exercise mat." },
  { id: 11, name: "Football",            category: "Sports",      price: 12000, emoji: "⚽", description: "Durable size-5 match ball." },
  { id: 12, name: "Water Bottle",        category: "Sports",      price: 9000,  emoji: "🧴", description: "1L insulated, keeps drinks cold for 24h." }
];

/* ============ STATE ============ */
let cart = loadCart();
let activeCategory = "All";

/* ============ HELPERS ============ */
const $ = (sel) => document.querySelector(sel);
const money = (n) =>
  new Intl.NumberFormat(CONFIG.locale, {
    style: "currency", currency: CONFIG.currency, maximumFractionDigits: 0
  }).format(n);

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || []; }
  catch { return []; }
}
function saveCart() {
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(cart)); } catch {}
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2000);
}
function imageHTML(p) {
  return p.image ? `<img src="${p.image}" alt="${p.name}">` : p.emoji || "📦";
}

/* ============ PRODUCTS RENDER ============ */
function renderFilters() {
  const cats = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
  $("#filters").innerHTML = cats
    .map((c) => `<button class="filter-btn ${c === activeCategory ? "active" : ""}" data-cat="${c}">${c}</button>`)
    .join("");
}

function getVisibleProducts() {
  const q = $("#search").value.trim().toLowerCase();
  const sort = $("#sort").value;

  let list = PRODUCTS.filter(
    (p) =>
      (activeCategory === "All" || p.category === activeCategory) &&
      (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
  );

  if (sort === "low") list.sort((a, b) => a.price - b.price);
  if (sort === "high") list.sort((a, b) => b.price - a.price);
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function renderProducts() {
  const list = getVisibleProducts();
  $("#products").innerHTML = list
    .map(
      (p) => `
    <article class="card">
      <div class="card-img">${imageHTML(p)}</div>
      <div class="card-body">
        <span class="card-cat">${p.category}</span>
        <h3 class="card-title">${p.name}</h3>
        <p class="card-desc">${p.description}</p>
        <div class="card-foot">
          <span class="price">${money(p.price)}</span>
          <button class="add-btn" data-id="${p.id}">Add to cart</button>
        </div>
      </div>
    </article>`
    )
    .join("");
  $("#empty").hidden = list.length > 0;
}

/* ============ CART LOGIC ============ */
function addToCart(id) {
  const item = cart.find((i) => i.id === id);
  if (item) item.qty++;
  else cart.push({ id, qty: 1 });
  updateCart();
  toast("Added to cart");
}
function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
  updateCart();
}
function removeFromCart(id) {
  cart = cart.filter((i) => i.id !== id);
  updateCart();
}
function cartTotal() {
  return cart.reduce((sum, i) => {
    const p = PRODUCTS.find((p) => p.id === i.id);
    return sum + (p ? p.price * i.qty : 0);
  }, 0);
}

function updateCart() {
  saveCart();
  $("#cartCount").textContent = cart.reduce((n, i) => n + i.qty, 0);
  $("#cartTotal").textContent = money(cartTotal());

  if (cart.length === 0) {
    $("#cartItems").innerHTML = `<p class="cart-empty">Your cart is empty 🛒</p>`;
    return;
  }

  $("#cartItems").innerHTML = cart
    .map((i) => {
      const p = PRODUCTS.find((p) => p.id === i.id);
      if (!p) return "";
      return `
      <div class="cart-item">
        <div class="cart-thumb">${imageHTML(p)}</div>
        <div class="cart-info">
          <h4>${p.name}</h4>
          <small>${money(p.price)}</small>
          <div class="qty">
            <button data-action="dec" data-id="${p.id}" aria-label="Decrease">−</button>
            <span>${i.qty}</span>
            <button data-action="inc" data-id="${p.id}" aria-label="Increase">+</button>
          </div>
        </div>
        <button class="remove" data-action="remove" data-id="${p.id}" aria-label="Remove">🗑</button>
      </div>`;
    })
    .join("");
}

function openCart() {
  $("#cart").classList.add("open");
  $("#overlay").classList.add("show");
}
function closeCart() {
  $("#cart").classList.remove("open");
  $("#overlay").classList.remove("show");
}

/* ============ EVENTS ============ */
$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  renderFilters();
  renderProducts();
});

$("#products").addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (btn) addToCart(Number(btn.dataset.id));
});

$("#cartItems").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "inc") changeQty(id, 1);
  if (btn.dataset.action === "dec") changeQty(id, -1);
  if (btn.dataset.action === "remove") removeFromCart(id);
});

$("#search").addEventListener("input", renderProducts);
$("#sort").addEventListener("change", renderProducts);
$("#cartBtn").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

$("#clearCart").addEventListener("click", () => { cart = []; updateCart(); });

$("#checkout").addEventListener("click", () => {
  if (cart.length === 0) return toast("Your cart is empty");
  /* TODO: connect to a real payment/back-end here
     (e.g. MTN MoMo, Stripe, Flutterwave, or your own API). */
  toast("Order placed! (demo)");
  cart = [];
  updateCart();
  closeCart();
});

/* ============ INIT ============ */
$("#year").textContent = new Date().getFullYear();
renderFilters();
renderProducts();
updateCart();