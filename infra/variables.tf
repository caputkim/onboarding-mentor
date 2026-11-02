variable "project_name" {
  description = "리소스 이름 접두어"
  type        = string
  default     = "nxtcloud-onboarding"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "aws_profile" {
  description = "AWS CLI 프로필. 비우면 환경 자격증명 사용"
  type        = string
  default     = ""
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-2"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "hosted_zone_name" {
  description = "Route53 공개 호스팅 존 (예: nxtcloud.kr)"
  type        = string
  default     = "nxtcloud.kr"
}

variable "app_hostname" {
  description = "멘토·운영 서비스 도메인. hosted_zone_name 아래여야 한다"
  type        = string
  default     = "onboard-mentor.nxtcloud.kr"
}

variable "newcomer_hostname" {
  description = "신입 서비스 도메인 (신입 스택의 app_hostname 과 같아야 한다). 구성원 안내 링크에 쓴다"
  type        = string
  default     = "onboard.nxtcloud.kr"
}

variable "ingress_cidrs" {
  description = "ALB 에 접근을 허용할 CIDR. 사내 IP 로 좁힐 수 있다"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "image_tag" {
  description = "ECR 에 푸시한 이미지 태그"
  type        = string
  default     = "latest"
}

variable "task_cpu" {
  type    = number
  default = 512
}

variable "task_memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "log_retention_days" {
  type    = number
  default = 90
}

variable "allowed_email_domain" {
  type    = string
  default = "nxtcloud.kr"
}

variable "seed_admin_email" {
  description = "이 이메일로 처음 가입하는 사람이 운영자가 된다 (운영자가 없을 때만)"
  type        = string
  default     = ""
}

variable "anthropic_api_key" {
  description = "비워 두면 apply 후 Secrets Manager 콘솔에서 넣는다. 이후 Terraform 은 이 값을 덮어쓰지 않는다"
  type        = string
  default     = ""
  sensitive   = true
}

variable "claude_model" {
  type    = string
  default = "claude-opus-5-5"
}
