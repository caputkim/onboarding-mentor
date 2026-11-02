# NxtCloud 온보딩 — 멘토·운영 서비스 인프라 + 플랫폼 공용 자원 (docs/03_아키텍처.md §7)
#
# 이 스택이 소유하는 것
#   공용: VPC·서브넷·NAT, RDS Postgres, Secrets Manager(DB URL·세션 비밀·토큰·API 키), Route53 존 참조
#   서비스: ECR, ECS 클러스터·서비스, ALB·ACM, EventBridge(주간 요약 cron)
# 신입 서비스 리포(onboarding-newcomer)의 infra 스택은 공용 자원을 이름·태그로 찾아 쓴다. 따라서 이 스택을 먼저 apply 한다.
#
#   인터넷 ─▶ Route53 ─▶ ALB (HTTPS) ─▶ ECS Fargate (mentor web) ─▶ RDS Postgres ◀─ ECS Fargate (newcomer web, 별도 스택)
#   EventBridge cron(0 21 ? * SUN *) ─▶ https://<mentor>/api/admin/cron/weekly-summary
#
# 배포 순서: ECR 푸시 → terraform apply → (운영자 가입: seed_admin_email) → 콘솔에서 플랜 가져오기 → ingest.py → 신입 스택 apply

locals {
  name         = "${var.project_name}-${var.environment}" # 공용 자원 이름 (newcomer 스택이 이 이름으로 찾는다)
  svc          = "${local.name}-mentor"                   # 이 서비스 전용 자원 이름
  name_short   = "onboard-${var.environment}-mentor"      # ALB·대상 그룹 (32자 제한)
  app_url      = "https://${var.app_hostname}"
  newcomer_url = "https://${var.newcomer_hostname}"
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}
