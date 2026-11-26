import hashlib
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent
DATABASE = Path(os.environ.get("DATABASE_PATH", ROOT / "data" / "orders.sqlite3"))
PRODUCTS = json.loads((ROOT / "products.json").read_text(encoding="utf-8"))
PRODUCTS_BY_ID = {product["id"]: product for product in PRODUCTS}
ASSETS = {
    "/": ("index.html", "text/html"),
    "/index.html": ("index.html", "text/html"),
    "/script.js": ("script.js", "text/javascript"),
    "/style.css": ("style.css", "text/css"),
}


def connect():
    return sqlite3.connect(DATABASE, timeout=5)


def initialize():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as db, db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                request_id TEXT PRIMARY KEY,
                fingerprint TEXT NOT NULL,
                receipt TEXT NOT NULL
            )
        """)


def order_items(payload):
    if not isinstance(payload, dict):
        raise ValueError("Expected an order object.")
    request_id = payload.get("requestId")
    if not isinstance(request_id, str) or not 1 <= len(request_id) <= 128:
        raise ValueError("A valid request ID is required.")
    items = payload.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= len(PRODUCTS):
        raise ValueError("Add at least one product to your cart.")
    quantities = {}
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Invalid cart item.")
        product_id, quantity = item.get("id"), item.get("qty")
        if type(product_id) is not int or product_id not in PRODUCTS_BY_ID:
            raise ValueError("Your cart contains an unknown product.")
        if product_id in quantities or type(quantity) is not int or not 1 <= quantity <= 99:
            raise ValueError("Each product must appear once with a quantity from 1 to 99.")
        quantities[product_id] = quantity
    return request_id, sorted(quantities.items())


def create_order(request_id, quantities):
    fingerprint = hashlib.sha256(json.dumps(quantities).encode()).hexdigest()
    lines = []
    for product_id, quantity in quantities:
        product = PRODUCTS_BY_ID[product_id]
        lines.append({
            "id": product_id,
            "name": product["name"],
            "quantity": quantity,
            "unitPrice": product["price"],
            "subtotal": product["price"] * quantity,
        })
    receipt = {
        "id": uuid4().hex,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "placed",
        "currency": "USD",
        "items": lines,
        "total": sum(line["subtotal"] for line in lines),
    }
    with closing(connect()) as db, db:
        result = db.execute(
            "INSERT INTO orders VALUES (?, ?, ?) ON CONFLICT(request_id) DO NOTHING",
            (request_id, fingerprint, json.dumps(receipt)),
        )
        if result.rowcount:
            return 201, receipt
        previous_fingerprint, previous_receipt = db.execute(
            "SELECT fingerprint, receipt FROM orders WHERE request_id = ?", (request_id,),
        ).fetchone()
        if fingerprint != previous_fingerprint:
            return 409, {"error": "This request ID was already used for a different cart."}
        return 200, json.loads(previous_receipt)


class StoreHandler(BaseHTTPRequestHandler):
    def send_body(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, payload):
        self.send_body(status, "application/json", json.dumps(payload).encode())

    def do_GET(self):
        path = self.path.partition("?")[0]
        if path == "/api/products":
            self.send_json(200, PRODUCTS)
        elif path == "/api/health":
            try:
                with closing(connect()) as db:
                    db.execute("SELECT 1 FROM orders LIMIT 1")
            except sqlite3.Error:
                self.send_json(503, {"status": "unavailable"})
            else:
                self.send_json(200, {"status": "ok"})
        elif path in ASSETS:
            filename, content_type = ASSETS[path]
            self.send_body(200, content_type, (ROOT / filename).read_bytes())
        else:
            self.send_json(404, {"error": "Not found."})

    def do_POST(self):
        if self.path.partition("?")[0] != "/api/orders":
            self.send_json(404, {"error": "Not found."})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Send an application/json request."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                raise ValueError
        except ValueError:
            self.send_json(400, {"error": "A request body is required."})
            return
        if length > 16_384:
            self.send_json(413, {"error": "Request body is too large."})
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except (ValueError, RecursionError):
            self.send_json(400, {"error": "Invalid JSON."})
            return
        try:
            request_id, quantities = order_items(payload)
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return
        try:
            status, receipt = create_order(request_id, quantities)
        except sqlite3.Error as error:
            self.log_error("Order storage failed: %s", error)
            self.send_json(503, {"error": "Checkout is temporarily unavailable. Try again."})
            return
        self.send_json(status, receipt)

    def setup(self):
        self.request.settimeout(10)
        super().setup()


if __name__ == "__main__":
    initialize()
    port = int(os.environ.get("PORT", "8000"))
    with ThreadingHTTPServer(("0.0.0.0", port), StoreHandler) as server:
        print(f"ShopEasy listening on port {port}", flush=True)
        server.serve_forever()
