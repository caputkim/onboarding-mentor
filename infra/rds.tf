resource "aws_db_instance" "main" {
  identifier = local.name

  engine                     = "postgres"
  engine_version             = "16"
  auto_minor_version_upgrade = true
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  max_allocated_storage      = var.db_allocated_storage * 5
  storage_type               = "gp3"
  storage_encrypted          = true

  db_name  = "onboard"
  username = "onboard"
  password = random_password.db.result

  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period   = 7
  backup_window             = "17:00-18:00" # KST 02:00-03:00
  maintenance_window        = "sun:18:00-sun:19:00"
  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"
  apply_immediately         = false
}

# pg_trgm 은 contrib 확장이라 별도 파라미터 없이 CREATE EXTENSION 으로 켜진다 (마이그레이션이 수행).
