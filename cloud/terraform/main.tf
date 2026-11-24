terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.4" }
  }
}
provider "aws" { region = var.aws_region }

data "aws_availability_zones" "available" { state = "available" }

resource "aws_vpc" "studycloud" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
  tags = { Name = "studycloud-vpc" }
}
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.studycloud.id
  tags = { Name = "studycloud-igw" }
}
resource "aws_subnet" "public" {
  count = 2
  vpc_id = aws_vpc.studycloud.id
  cidr_block = cidrsubnet(aws_vpc.studycloud.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "studycloud-public-${count.index + 1}" }
}
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.studycloud.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}
resource "aws_route_table_association" "public" {
  count = 2
  subnet_id = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
resource "aws_subnet" "private" {
  count = 2
  vpc_id = aws_vpc.studycloud.id
  cidr_block = cidrsubnet(aws_vpc.studycloud.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "studycloud-private-${count.index + 1}" }
}
resource "aws_security_group" "app" {
  name = "studycloud-app-sg"
  description = "Application ingress; restrict cidr before deployment"
  vpc_id = aws_vpc.studycloud.id
  ingress {
    from_port = 5000
    to_port = 5000
    protocol = "tcp"
    cidr_blocks = var.allowed_app_cidr
  }
  ingress { from_port = 22; to_port = 22; protocol = "tcp"; cidr_blocks = var.allowed_app_cidr }
  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
resource "aws_security_group" "rds" {
  name = "studycloud-rds-sg"
  vpc_id = aws_vpc.studycloud.id
  ingress {
    from_port = 3306
    to_port = 3306
    protocol = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
resource "aws_db_subnet_group" "rds" {
  name = "studycloud-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}
resource "aws_db_instance" "mysql" {
  identifier = "studycloud-mysql"
  engine = "mysql"
  engine_version = "8.0"
  instance_class = var.db_instance_class
  allocated_storage = 20
  storage_type = "gp3"
  db_name = "studycloud"
  username = var.db_username
  password = var.db_password
  db_subnet_group_name = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible = false
  skip_final_snapshot = true
  backup_retention_period = 1
}
resource "aws_s3_bucket" "materials" {
  bucket = var.s3_bucket_name
}
resource "aws_s3_bucket_public_access_block" "materials" {
  bucket = aws_s3_bucket.materials.id
  block_public_acls = true
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "materials" {
  bucket = aws_s3_bucket.materials.id
  versioning_configuration { status = "Enabled" }
}
output "s3_bucket_name" { value = aws_s3_bucket.materials.bucket }
output "rds_endpoint" { value = aws_db_instance.mysql.address }
output "app_security_group_id" { value = aws_security_group.app.id }

data "archive_file" "lambda" {
  type = "zip"
  source_file = "../lambda/health_check.py"
  output_path = "${path.module}/health_check.zip"
}
resource "aws_iam_role" "lambda" {
  name = "studycloud-health-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_lambda_function" "health" {
  function_name = "studycloud-health-check"
  role = aws_iam_role.lambda.arn
  handler = "health_check.handler"
  runtime = "python3.12"
  filename = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout = 10
  environment {
    variables = { STUDYCLOUD_HEALTH_URL = var.health_url }
  }
}
output "lambda_function_name" { value = aws_lambda_function.health.function_name }
