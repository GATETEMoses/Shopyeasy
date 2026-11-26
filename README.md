# ShopEasy

Start the storefront and API with Docker Compose.

```sh
docker compose up --build -d
docker compose ps
```

Open http://localhost:8000. Set `SHOP_PORT` before starting Compose to change the host port. The named `orders` volume stores SQLite data across container replacements. Preserve that volume when redeploying and back it up before removing it. For a public deployment, put the service behind an HTTPS reverse proxy.

For local development with Python 3.10 or newer, run `python server.py` and open the same URL. Local orders are stored in `data/orders.sqlite3` by default. Set `DATABASE_PATH` or `PORT` to override the local defaults.

- `GET /api/products` returns the catalog in `products.json`.
- `POST /api/orders` accepts JSON such as `{"requestId":"unique-checkout-id","items":[{"id":1,"qty":2}]}`. The server calculates the USD total and stores the order. Repeat a request with the same ID and items to retrieve the same receipt.
- `GET /api/health` checks the service and its order database.

Checkout creates an unpaid order. The cart stays in browser storage until checkout succeeds.


## Kubernetes

For a running Minikube cluster with the default storage class, run these commands from the project folder.

```sh
docker build -t shopeasy:1.0.0 .
minikube image load shopeasy:1.0.0
kubectl --context minikube apply -f k8s/shopeasy.yaml
kubectl --context minikube rollout status deployment/shopeasy
kubectl --context minikube port-forward service/shopeasy 8080:8000
```

Open http://localhost:8080. The deployment runs one replica with the Recreate strategy so a rollout replaces the SQLite writer before starting its successor. The shopeasy-orders claim provides a separate database from Docker Compose. Existing orders require a SQLite backup and restore to migrate. Preserve the claim across redeploys.

For a remote cluster, publish a versioned image to a registry the cluster can pull from and update the manifest's image reference before applying it to that cluster. The manifest expects a default storage class that provides a filesystem volume supporting SQLite locking and pod group permissions. Configure cluster ingress with HTTPS if public access is needed.

## CI/CD

GitHub Actions runs the build and container smoke tests for pull requests and pushes to main. For main, it hands the tested commit-tagged image to a deployment job as a workflow artifact. The deployment applies shopeasy.yaml with that image, waits for rollout, and checks service health. It uses the existing orders claim.

1. Put this project in a trusted GitHub repository with main as its deployment branch.
2. Create the minikube GitHub Actions environment and restrict its deployment branches to main.
3. Register a Windows self-hosted runner with the shopeasy-minikube label. Run it under a Windows account that can access Docker and the existing Docker-backed Minikube profile named minikube. Keep that cluster running.
4. Push to main or run ShopEasy CI/CD manually from main. Check the build and deployment jobs in the Actions tab.

The runner deploys into the default Kubernetes namespace through the Docker-backed Minikube node. Docker and Minikube must be in the runner account's PATH. Restrict access to the deployment branch and this runner to trusted maintainers since the runner can administer the local cluster.
