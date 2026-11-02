resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

resource "random_password" "ingest_token" {
  length  = 48
  special = false
}

resource "random_password" "cron_token" {
  length  = 48
  special = false
}

# Terraform 이 관리하는 값들 (DB URL · 세션 비밀 · 토큰)
resource "aws_secretsmanager_secret" "generated" {
  name                    = "${local.name}/generated"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "generated" {
  secret_id = aws_secretsmanager_secret.generated.id
  secret_string = jsonencode({
    DATABASE_URL = "postgresql://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}?schema=public&sslmode=require"
    AUTH_SECRET  = random_password.auth_secret.result
    INGEST_TOKEN = random_password.ingest_token.result
    CRON_TOKEN   = random_password.cron_token.result
  })
}

# 사람이 넣는 값 (Anthropic API 키). 콘솔에서 바꿔도 Terraform 이 덮어쓰지 않는다.
resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({ ANTHROPIC_API_KEY = var.anthropic_api_key })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
