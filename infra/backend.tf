# 상태 저장소. 로컬 검증(terraform init -backend=false / validate)에는 필요 없다.
# 운영 시 아래 주석을 풀고 Gateway 와 같은 state 버킷을 쓴다 (nxtcloud-llm-gateway/infra/bootstrap 참고).
#
# terraform {
#   backend "s3" {
#     bucket       = "nxtcloud-llm-gateway-tfstate-<account-id>"
#     key          = "onboarding/mentor/terraform.tfstate"
#     region       = "ap-northeast-2"
#     encrypt      = true
#     use_lockfile = true
#   }
# }
