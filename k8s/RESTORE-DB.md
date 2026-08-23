# Runbook: replace Neon with self-hosted Postgres on the k3s node

**Why:** On 2026-08-23 the gallery and all auth broke. Root cause: Neon's
free-tier compute quota was exhausted (`Your account or project has exceeded
the compute time quota`), so every Postgres connection was refused — the
auth-service crash-looped at boot and the gateway's `/gallery` query returned
500. The quota burns out every month because the gateway's `pgxpool` holds
connections open 24/7, which prevents Neon's serverless compute from ever
suspending. Fix: run Postgres on the EC2 node itself (`k8s/postgres.yaml`),
with a nightly S3 backup (`k8s/postgres-backup.yaml`).

The DB password is generated on the host and only ever lives in the
`postgres-admin` k3s secret — later steps read it back from there, so it
never appears in a terminal or shell history.

All commands run from the repo root. `$SSH` below means:

```bash
SSH="ssh -i ~/.ssh/inkshield-key.pem ubuntu@inkshield-api.duckdns.org"
```

## 1. Copy the manifests to the host

```bash
$SSH 'mkdir -p ~/k8s'
scp -i ~/.ssh/inkshield-key.pem k8s/postgres.yaml k8s/postgres-backup.yaml \
    ubuntu@inkshield-api.duckdns.org:~/k8s/
```

## 2. Create the admin secret (password generated on the host) and deploy

```bash
$SSH 'sudo k3s kubectl create secret generic postgres-admin \
        --from-literal=POSTGRES_USER=inkshield \
        --from-literal=POSTGRES_PASSWORD=$(openssl rand -hex 24) \
        --from-literal=POSTGRES_DB=inkshield && \
      sudo k3s kubectl apply -f ~/k8s/postgres.yaml -f ~/k8s/postgres-backup.yaml && \
      sudo k3s kubectl rollout status deploy/postgres'
```

The schema (users/images/likes) is created automatically on first boot by the
`postgres-init` ConfigMap.

## 3. Point the services at the new database and restart them

Recreates `db-credentials` with in-cluster URLs, reading the password back out
of `postgres-admin`. `sslmode=disable` is correct here — traffic never leaves
the node.

```bash
$SSH 'PW=$(sudo k3s kubectl get secret postgres-admin -o jsonpath={.data.POSTGRES_PASSWORD} | base64 -d) && \
      sudo k3s kubectl delete secret db-credentials && \
      sudo k3s kubectl create secret generic db-credentials \
        --from-literal=DATABASE_URL="postgresql://inkshield:$PW@postgres:5432/inkshield?sslmode=disable" \
        --from-literal=SPRING_DATASOURCE_URL="jdbc:postgresql://postgres:5432/inkshield?sslmode=disable" \
        --from-literal=SPRING_DATASOURCE_USERNAME=inkshield \
        --from-literal=SPRING_DATASOURCE_PASSWORD="$PW" && \
      sudo k3s kubectl rollout restart deploy/gateway deploy/auth-service deploy/ml-service && \
      sudo k3s kubectl get pods'
```

`auth-service` should reach `1/1 Running` within a minute or two (it sat in
CrashLoopBackOff the whole outage, so its backoff timer may delay the first
restart).

## 4. Verify

```bash
curl https://inkshield-api.duckdns.org/gallery?sort=recent   # expect 200 + JSON array
curl -X POST https://inkshield-api.duckdns.org/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@x.com","password":"x"}'
# expect 401/400 (a real auth answer), NOT 502
```

Then load https://www.inkshield.art/gallery in a browser.

## 5. Test the backup once, don't wait for 09:17 UTC

```bash
$SSH 'sudo k3s kubectl create job --from=cronjob/postgres-backup backup-test && \
      sudo k3s kubectl wait --for=condition=complete --timeout=180s job/backup-test && \
      sudo k3s kubectl logs job/backup-test && \
      sudo k3s kubectl delete job backup-test'
```

Success = the job completes and a `backups/inkshield-<date>.sql.gz` object
appears in the S3 bucket. Backups accumulate one per day; add an S3 lifecycle
rule on the `backups/` prefix (e.g. expire after 30 days) to cap storage.

To restore from a backup:

```bash
aws s3 cp s3://<bucket>/backups/inkshield-<date>.sql.gz - | gunzip \
  | $SSH 'sudo k3s kubectl exec -i deploy/postgres -- psql -U inkshield inkshield'
```

## Old data in Neon

The Neon project is locked until its quota resets (~Sep 1). Existing accounts
and published images start empty on the new database. To migrate the old rows
after the reset:

```bash
pg_dump --data-only -t users -t images -t likes "<old neon DATABASE_URL>" \
  | $SSH 'sudo k3s kubectl exec -i deploy/postgres -- psql -U inkshield inkshield'
```

(Accounts created in the meantime with the same email would conflict on the
unique email constraint — resolve those by hand if any.)
