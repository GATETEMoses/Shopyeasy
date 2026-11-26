/* ============ CONFIG (customise here) ============ */


const CONFIG = {
  currency: "USD",
  locale: "en-EN",
  storageKey: "shopeasy_cart"
};

let PRODUCTS = [];




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

let pendingCheckout;

$("#checkout").addEventListener("click", async () => {
  if (cart.length === 0) return toast("Your cart is empty");
  const button = $("#checkout");
  const items = JSON.stringify(cart);
  if (pendingCheckout?.items !== items) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const requestId = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    pendingCheckout = { items, requestId };
  }
  button.disabled = true;
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: pendingCheckout.requestId, items: JSON.parse(items) })
    });
    const receipt = await response.json();
    if (!response.ok) return toast(receipt.error || "Checkout failed. Try again.");
    pendingCheckout = undefined;
    if (JSON.stringify(cart) === items) {
      cart = [];
      updateCart();
      closeCart();
    }
    toast("Order placed · " + receipt.id.slice(0, 8));
  } catch {
    toast("Could not reach checkout. Try again.");
  } finally {
    button.disabled = false;
  }
});

async function initializeStore() {
  $("#year").textContent = new Date().getFullYear();
  $("#checkout").disabled = true;
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Catalog request failed");
    PRODUCTS = await response.json();
    cart = cart.filter((item) => PRODUCTS.some((product) => product.id === item.id));
    renderFilters();
    renderProducts();
    updateCart();
    $("#checkout").disabled = false;
  } catch {
    $("#products").textContent = "The catalog could not load. Refresh to try again.";
  }
}

initializeStore();