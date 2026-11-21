# Tenant deployment: every resource is created inside the brand's own
# Google Cloud project. The platform operates no shared infrastructure.

locals {
  enabled_services = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "aiplatform.googleapis.com",
  ])
}

resource "google_project_service" "enabled" {
  for_each           = local.enabled_services
  service            = each.value
  disable_on_destroy = false
}

resource "google_firestore_database" "luxe" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.enabled["firestore.googleapis.com"]]
}

resource "google_artifact_registry_repository" "luxe" {
  project       = var.project_id
  location      = var.region
  repository_id = "luxe"
  format        = "DOCKER"

  depends_on = [google_project_service.enabled["artifactregistry.googleapis.com"]]
}

resource "google_secret_manager_secret" "gemini_api_key" {
  project   = var.project_id
  secret_id = "luxe-gemini-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "gemini_api_key" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}

resource "google_secret_manager_secret" "whatsapp_verify_token" {
  project   = var.project_id
  secret_id = "luxe-whatsapp-verify-token"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "whatsapp_verify_token" {
  secret      = google_secret_manager_secret.whatsapp_verify_token.id
  secret_data = var.whatsapp_verify_token
}

resource "google_secret_manager_secret" "copilot_api_key" {
  project   = var.project_id
  secret_id = "luxe-copilot-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "copilot_api_key" {
  secret      = google_secret_manager_secret.copilot_api_key.id
  secret_data = var.copilot_api_key
}

resource "google_service_account" "copilot_runtime" {
  project      = var.project_id
  account_id   = "luxe-copilot-runtime"
  display_name = "luxe copilot runtime"
}

resource "google_project_iam_member" "runtime_roles" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/datastore.user",
    "roles/aiplatform.user",
  ])

  project = var.project_id
  role    = each.value
  member  = google_service_account.copilot_runtime.member
}

resource "google_cloud_run_v2_service" "copilot" {
  name                = var.service_name
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.copilot_runtime.email

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          memory = "512Mi"
          cpu    = "1"
        }
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      env {
        name  = "FIRESTORE_PROJECT"
        value = var.project_id
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "WHATSAPP_VERIFY_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.whatsapp_verify_token.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "COPILOT_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.copilot_api_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.enabled["run.googleapis.com"],
    google_project_iam_member.runtime_roles,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  name     = google_cloud_run_v2_service.copilot.name
  location = google_cloud_run_v2_service.copilot.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
