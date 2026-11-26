import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:8000"


def request(path, payload=None):
    headers = {"Content-Type": "application/json"} if payload is not None else {}
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(BASE + path, data=body, headers=headers)
    try:
        response = urlopen(req, timeout=3)
    except HTTPError as error:
        response = error
    with response:
        data = response.read()
        if response.headers.get_content_type() == "application/json":
            data = json.loads(data)
        return response.code, data


for attempt in range(20):
    try:
        if request("/api/health") == (200, {"status": "ok"}):
            break
    except URLError:
        pass
    time.sleep(0.5)
else:
    raise RuntimeError("The application did not become healthy.")

for path in ("/", "/script.js", "/style.css"):
    status, body = request(path)
    assert status == 200 and body, path

status, products = request("/api/products")
assert status == 200 and products
product = products[0]
order = {"requestId": "ci-checkout", "items": [{"id": product["id"], "qty": 2, "price": 1}]}
status, receipt = request("/api/orders", order)
assert status == 201
assert receipt["total"] == product["price"] * 2
assert request("/api/orders", order) == (200, receipt)
order["items"][0]["qty"] = 3
assert request("/api/orders", order)[0] == 409
order["items"][0]["qty"] = 0
assert request("/api/orders", order)[0] == 400
print("Storefront, catalog, checkout pricing, receipt retries, and validation passed.")
