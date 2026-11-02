# 배치: EventBridge 규칙 → API Destination → 앱의 cron 엔드포인트 (Bearer CRON_TOKEN)
# 이미지에 별도 스크립트 런타임을 넣지 않기 위해 HTTP 로 호출한다.
# 이 스택은 주간 요약만 건다. 대화 보존 정리(retention)는 신입 서비스 리포의 infra 스택에 있다.

resource "aws_cloudwatch_event_connection" "cron" {
  name               = "${local.svc}-cron"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "Authorization"
      value = "Bearer ${random_password.cron_token.result}"
    }
  }
}

locals {
  cron_jobs = {
    weekly-summary = { path = "weekly-summary", schedule = "cron(0 21 ? * SUN *)", description = "월요일 06:00 KST 멘토 주간 요약" }
  }
}

resource "aws_cloudwatch_event_api_destination" "cron" {
  for_each = local.cron_jobs

  name                             = "${local.svc}-${each.key}"
  description                      = each.value.description
  connection_arn                   = aws_cloudwatch_event_connection.cron.arn
  invocation_endpoint              = "${local.app_url}/api/admin/cron/${each.value.path}"
  http_method                      = "POST"
  invocation_rate_limit_per_second = 1
}

resource "aws_cloudwatch_event_rule" "cron" {
  for_each = local.cron_jobs

  name                = "${local.svc}-${each.key}"
  description         = each.value.description
  schedule_expression = each.value.schedule
}

data "aws_iam_policy_document" "events_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events" {
  name               = "${local.svc}-events"
  assume_role_policy = data.aws_iam_policy_document.events_assume.json
}

data "aws_iam_policy_document" "events_invoke" {
  statement {
    actions   = ["events:InvokeApiDestination"]
    resources = [for d in aws_cloudwatch_event_api_destination.cron : d.arn]
  }
}

resource "aws_iam_role_policy" "events_invoke" {
  name   = "invoke-api-destination"
  role   = aws_iam_role.events.id
  policy = data.aws_iam_policy_document.events_invoke.json
}

resource "aws_cloudwatch_event_target" "cron" {
  for_each = local.cron_jobs

  rule     = aws_cloudwatch_event_rule.cron[each.key].name
  arn      = aws_cloudwatch_event_api_destination.cron[each.key].arn
  role_arn = aws_iam_role.events.arn

  retry_policy {
    maximum_event_age_in_seconds = 3600
    maximum_retry_attempts       = 3
  }
}
