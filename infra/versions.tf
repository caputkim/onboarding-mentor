terraform {
  required_version = ">= 1.13.0"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.71" }
    random = { source = "hashicorp/random", version = "~> 3.9" }
  }
}

provider "aws" {
  # 프로필은 비워 두면 환경 자격증명(AWS_PROFILE·SSO·역할)을 쓴다.
  profile = var.aws_profile == "" ? null : var.aws_profile
  region  = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
