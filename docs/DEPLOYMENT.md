# Deployment

Deploy Luxe into your own Google Cloud project. Each deployment is a single-brand tenant: Firestore, Cloud Run, Firebase Hosting, Secret Manager, and least-privilege IAM, provisioned per brand. There is no multi-tenant option.

## Prerequisites

- A Google Cloud project with billing enabled.
- `gcloud` authenticated and pointed at the project (`gcloud auth login`, then `gcloud config set-project YOUR_PROJECT`).
- Terraform 1.9 or later.
- Docker for the API container; Node 20+ and pnpm 12+ for the web build.

## 1. Provision the infrastructure

```bash
cd infra/terraform
terraform init
terraform apply -var project_id=YOUR_PROJECT -var region=europe-west1
```

This provisions Firestore, Cloud Run, Firebase Hosting, Secret Manager, and IAM roles for the tenant.

## 2. Configure secrets

Store provider credentials in Secret Manager as described in [../infra/terraform/README.md](../infra/terraform/README.md): either `GEMINI_API_KEY` for the Gemini API-key provider, or the service account key for the Vertex AI provider (`GOOGLE_PROJECT` with `GOOGLE_APPLICATION_CREDENTIALS`). Secrets belong in Secret Manager, never in version control or Terraform variables.

## 3. Build and deploy the API

From the repository root:

```bash
docker build -f packages/copilot-api/Dockerfile -t REGION-docker.pkg.dev/YOUR_PROJECT/Luxe/copilot-api:latest .
```

Deploy the image to Cloud Run (`gcloud run deploy`, or the Cloud Run module in `infra/terraform`). Set the runtime environment: `FIRESTORE_PROJECT`, `WHATSAPP_VERIFY_TOKEN`, and the provider variables from step 2.

## 4. Deploy the web app

```bash
pnpm install
VITE_API_URL=https://YOUR-API-HOST pnpm build
```

Deploy `dist/` to Firebase Hosting or any static host. `VITE_API_URL` is baked in at build time; rebuild when the API host changes.

## 5. Connect WhatsApp

In the WhatsApp Business API configuration, point the webhook at the deployed API (`https://YOUR-API-HOST/webhook/whatsapp`) and set the verification token to match `WHATSAPP_VERIFY_TOKEN`. Inbound messages are stored as interactions; outbound delivery follows advisor approval.

## Data residency

Choose the region deliberately. The Firestore location is set at instance creation and is immutable; moving to another region requires a new instance and a data migration. Model provider calls follow the provider configuration — brands that require in-region processing select the Vertex AI provider.

## Access control

Cloud Run invoker is restricted by default after provisioning. Grant the invoker role to your advisors' Google identities only, and keep administration of the project with the brand administrator.
