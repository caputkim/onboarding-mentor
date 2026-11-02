output "app_url" {
  value = local.app_url
}

output "alb_dns_name" {
  value = aws_lb.web.dns_name
}

output "ecr_repository_url" {
  description = "리포 루트에서: docker buildx build --platform linux/arm64 -f web/Dockerfile -t <이 값>:<tag> . && docker push"
  value       = aws_ecr_repository.web.repository_url
}

# ---------- 신입 서비스 스택이 이름으로 찾는 공용 자원 (참고용 출력) ----------
output "shared_vpc_id" {
  value = module.vpc.vpc_id
}

output "shared_private_subnet_ids" {
  value = module.vpc.private_subnets
}

output "shared_rds_security_group_id" {
  value = aws_security_group.rds.id
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.web.name
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "secret_app_arn" {
  description = "ANTHROPIC_API_KEY 를 콘솔에서 넣는 시크릿"
  value       = aws_secretsmanager_secret.app.arn
}

output "secret_generated_arn" {
  description = "INGEST_TOKEN(ingest.py 용)·CRON_TOKEN 은 여기서 읽는다"
  value       = aws_secretsmanager_secret.generated.arn
}

output "cron_endpoints" {
  value = { for k, d in aws_cloudwatch_event_api_destination.cron : k => d.invocation_endpoint }
}
