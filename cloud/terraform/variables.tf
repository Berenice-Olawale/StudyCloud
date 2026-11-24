variable "aws_region" { type = string; default = "eu-central-1" }
variable "allowed_app_cidr" { type = list(string); description = "Restrict this to your trusted IP range; do not use 0.0.0.0/0 for SSH." }
variable "s3_bucket_name" { type = string; description = "Globally unique S3 bucket name." }
variable "db_instance_class" { type = string; default = "db.t3.micro" }
variable "db_username" { type = string; default = "studycloud_admin" }
variable "db_password" { type = string; sensitive = true }

variable "health_url" {
  type = string
  default = ""
}
