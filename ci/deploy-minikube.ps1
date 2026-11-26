param(
    [Parameter(Mandatory)]
    [ValidatePattern('^shopeasy:[0-9a-f]{40}$')]
    [string]$Image
)

$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PSScriptRoot '../shopeasy.yaml'

# Run kubectl inside the Docker-backed Minikube node using its trusted API configuration.
$kubectl = docker exec minikube readlink -f /var/lib/minikube/binaries
if ($LASTEXITCODE -ne 0) { throw 'The Minikube Docker node must be running.' }
$binaryRoot = $kubectl.Trim()
$kubelet = docker exec minikube sh -c 'readlink -f /proc/$(pgrep -x kubelet | head -n 1)/exe'
if ($LASTEXITCODE -ne 0 -or !$kubelet.StartsWith("$binaryRoot/")) {
    throw 'Could not locate the Kubernetes binaries for the running Minikube node.'
}
$kubectl = $kubelet -replace '/kubelet$', '/kubectl'
$nodeArgs = @('exec', '-i', 'minikube', $kubectl, '--kubeconfig=/etc/kubernetes/admin.conf', '--namespace=default')

docker @nodeArgs --request-timeout=10s get --raw /readyz
if ($LASTEXITCODE -ne 0) { throw 'The Minikube API is unavailable.' }

minikube image load $Image --profile minikube
if ($LASTEXITCODE -ne 0) { throw "Could not load $Image into Minikube." }

$manifest = Get-Content -LiteralPath $manifestPath -Raw
$imageLine = '(?m)^([ \t]*image: )shopeasy:[^\s]+[ \t]*\r?$'
if ([regex]::Matches($manifest, $imageLine).Count -ne 1) {
    throw 'Expected one ShopEasy image in shopeasy.yaml.'
}
$manifest -replace $imageLine, ('$1' + $Image) | docker @nodeArgs apply -f -
if ($LASTEXITCODE -ne 0) { throw 'Could not apply the ShopEasy manifest.' }

docker @nodeArgs rollout status deployment/shopeasy --timeout=120s
if ($LASTEXITCODE -ne 0) {
    docker @nodeArgs describe pods -l app=shopeasy
    throw 'The ShopEasy rollout did not become ready.'
}

$verifyArgs = $nodeArgs + @('exec', 'deployment/shopeasy', '--', 'python', '-c')
docker @verifyArgs "from urllib.request import urlopen; urlopen('http://shopeasy:8000/api/health', timeout=5).close()"
if ($LASTEXITCODE -ne 0) { throw 'The ShopEasy service health check failed.' }
