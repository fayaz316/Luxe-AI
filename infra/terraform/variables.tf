variable "project_id" {
  description = "Google Cloud project id owned by the deploying brand. All resources are created inside this project."
  type        = string
}

variable "region" {
  description = "Google Cloud region for Cloud Run and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "firestore_location" {
  description = "Location for the Firestore database. Immutable once set; choose per data-residency requirements."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "luxe-copilot"
}

variable "image" {
  description = "Container image for the copilot API (e.g. REGION-docker.pkg.dev/PROJECT/REPO/luxe-copilot-api:latest)."
  type        = string
}

variable "gemini_api_key" {
  description = "Gemini API key for drafting. Leave empty to deploy with the deterministic mock provider and populate the secret later."
  type        = string
  sensitive   = true
  default     = ""
}

variable "whatsapp_verify_token" {
  description = "Verification token for the WhatsApp webhook handshake."
  type        = string
  sensitive   = true
  default     = "luxe-dev-verify"
}

variable "copilot_api_key" {
  description = "Optional shared secret required by the copilot API in the x-api-key header. Leave empty to disable key enforcement (rely on Cloud Run invoker IAM alone)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "allow_unauthenticated" {
  description = "Allow unauthenticated invocation of the Cloud Run service. Disabled by default; grant roles/run.invoker to advisor identities instead."
  type        = bool
  default     = false
}
