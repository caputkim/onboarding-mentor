resource "aws_ecs_cluster" "main" {
  name = local.svc

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.svc}/web"
  retention_in_days = var.log_retention_days
}

# ---------- IAM ----------
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# 실행 역할: 이미지 풀, 로그, 시크릿 주입
resource "aws_iam_role" "task_execution" {
  name               = "${local.svc}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.generated.arn, aws_secretsmanager_secret.app.arn]
  }
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name   = "secrets"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_secrets.json
}

# 태스크 역할: 앱이 AWS API 를 직접 쓰지 않으므로 권한 없음 (추후 S3 등 필요 시 여기에)
resource "aws_iam_role" "task" {
  name               = "${local.svc}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# ---------- 태스크 정의 ----------
locals {
  container_env = {
    NODE_ENV             = "production"
    AUTH_URL             = local.app_url
    AUTH_TRUST_HOST      = "true"
    ALLOWED_EMAIL_DOMAIN = var.allowed_email_domain
    SEED_ADMIN_EMAIL     = var.seed_admin_email
    CLAUDE_MODEL         = var.claude_model
    NEWCOMER_APP_URL     = local.newcomer_url
    PLANS_DIR            = "/app/plans"
  }
  container_secrets = {
    DATABASE_URL      = "${aws_secretsmanager_secret.generated.arn}:DATABASE_URL::"
    AUTH_SECRET       = "${aws_secretsmanager_secret.generated.arn}:AUTH_SECRET::"
    INGEST_TOKEN      = "${aws_secretsmanager_secret.generated.arn}:INGEST_TOKEN::"
    CRON_TOKEN        = "${aws_secretsmanager_secret.generated.arn}:CRON_TOKEN::"
    ANTHROPIC_API_KEY = "${aws_secretsmanager_secret.app.arn}:ANTHROPIC_API_KEY::"
  }
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.svc}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64" # Graviton. 이미지는 linux/arm64 로 빌드한다 (web/Dockerfile 상단 참고)
  }

  container_definitions = jsonencode([
    {
      name         = "web"
      image        = "${aws_ecr_repository.web.repository_url}:${var.image_tag}"
      essential    = true
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment  = [for k, v in local.container_env : { name = k, value = v }]
      secrets      = [for k, v in local.container_secrets : { name = k, valueFrom = v }]
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/login > /dev/null || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60 # 시작 시 prisma migrate deploy 가 먼저 돈다
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.web.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "web"
        }
      }
    }
  ])
}

# ---------- 서비스 ----------
resource "aws_ecs_service" "web" {
  name            = "${local.svc}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # 마이그레이션이 단일 인스턴스를 전제하므로 교체 배포 시 동시 2개를 허용하되 짧게 겹친다.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 90
  enable_execute_command             = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]
}
