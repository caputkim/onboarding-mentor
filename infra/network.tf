module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.7"

  name = local.name
  cidr = var.vpc_cidr
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)

  public_subnets   = [cidrsubnet(var.vpc_cidr, 8, 0), cidrsubnet(var.vpc_cidr, 8, 1)]
  private_subnets  = [cidrsubnet(var.vpc_cidr, 8, 10), cidrsubnet(var.vpc_cidr, 8, 11)]
  database_subnets = [cidrsubnet(var.vpc_cidr, 8, 20), cidrsubnet(var.vpc_cidr, 8, 21)]

  create_database_subnet_group = true
  enable_nat_gateway           = true # ECS 태스크가 Anthropic API 로 나가는 경로
  single_nat_gateway           = true
  enable_dns_hostnames         = true
  enable_dns_support           = true
}

# ---------- 보안 그룹: ALB → ECS → RDS 한 방향 ----------
resource "aws_security_group" "alb" {
  name        = "${local.svc}-alb"
  description = "ALB ingress"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.ingress_cidrs
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.ingress_cidrs
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${local.svc}-ecs"
  description = "ECS tasks: only from ALB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 공용. inline ingress 대신 독립 규칙을 쓴다 — newcomer 스택이 자기 ECS SG 를 여기에 추가한다.
resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "RDS: only from ECS tasks (mentor + newcomer)"
  vpc_id      = module.vpc.vpc_id

  tags = { Name = "${local.name}-rds" }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_mentor" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "mentor ECS tasks"
}
