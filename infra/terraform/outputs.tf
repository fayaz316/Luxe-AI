output "service_url" {
  description = "URL of the deployed copilot API service."
  value       = google_cloud_run_v2_service.copilot.uri
}

output "project_id" {
  description = "Project the tenant was deployed into."
  value       = var.project_id
}

output "artifact_registry_url" {
  description = "Docker repository for the copilot API image."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.lux.repository_id}"
}
