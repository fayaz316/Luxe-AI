# Tenant Deployment (Terraform)

Every lux deployment runs inside the deploying brand's own Google Cloud
project. This module creates:

- Firestore database (native mode, brand-selected location)
- Artifact Registry repository for the copilot API image
- Secret Manager secrets (`lux-gemini-api-key`, `lux-whatsapp-verify-token`)
- Least-privilege runtime service account (secret accessor, datastore user,
  AI platform user)
- Cloud Run service for `copilot-api`, restricted invocation by default

## Prerequisites

- A Google Cloud project with billing enabled, owned by the brand
- `gcloud` authenticated with permissions to create the resources above
- Terraform >= 1.9

## Deploy

```bash
cd infra/terraform
terraform init
terraform apply \
  -var project_id=YOUR_PROJECT \
  -var region=europe-west4 \
  -var firestore_location=europe-west4 \
  -var image=REGION-docker.pkg.dev/YOUR_PROJECT/lux/lux-copilot-api:latest
```

Build and push the image from the repository root first:

```bash
docker build -f packages/copilot-api/Dockerfile \
  -t REGION-docker.pkg.dev/YOUR_PROJECT/lux/lux-copilot-api:latest .
docker push REGION-docker.pkg.dev/YOUR_PROJECT/lux/lux-copilot-api:latest
```

## After deployment

1. **Access.** The Cloud Run service rejects unauthenticated calls by default.
   Grant `roles/run.invoker` to your advisors' Google identities, or set
   `allow_unauthenticated=true` only if you accept public reachability.
2. **Model provider.** Populate `lux-gemini-api-key` in Secret Manager (or
   run with Vertex AI by granting the runtime service account access and
   removing the API-key env var). Until a key is set, the service runs with
   a deterministic mock provider.
3. **WhatsApp.** Point the Meta webhook at
   `$(terraform output -raw service_url)/webhook/whatsapp` with the verify
   token from `lux-whatsapp-verify-token`.
4. **Web app.** Deploy `apps/copilot-web` (any static host; Firebase Hosting
   is the default path) with `VITE_API_URL` set to the service URL.

## Data residency notes

- Firestore location is immutable once created. Select it deliberately.
- Secrets use automatic replication; restrict replication to the brand's
  region if policy requires it.

## Security notes

- No resource in this module grants access outside the brand's project.
- The runtime service account holds the minimum roles listed above.
- `deletion_protection` is disabled for evaluation convenience; enable it
  for production deployments.
