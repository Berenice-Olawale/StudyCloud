# StudyCloud Cloud Engineering

StudyCloud backend is Flask + Flask-SQLAlchemy. This cloud-ready configuration supports local SQLite/local uploads by default and AWS MySQL RDS/S3 through environment variables.

## Architecture
- VPC: isolated AWS network with public subnets for a future application tier and private subnets for RDS.
- RDS: MySQL 8.0, non-public, reachable only through the app security group.
- S3: private bucket with public-access blocking and versioning enabled; study materials use per-student object keys.
- Lambda: lightweight API health-check function.
- Backend: Flask API container (Docker).

## Local development
1. `cd backend`
2. Create a virtual environment and install `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env`, set strong local secrets.
4. Leave `DATABASE_URL` and `S3_BUCKET` blank for SQLite and local upload storage.
5. Run `python app.py`.

## Docker
From `backend`, copy `.env.example` to `.env` and configure it, then run:
`docker compose up --build`
API is at `http://localhost:5000`.

## AWS configuration
1. Install Terraform and configure AWS credentials with an IAM user/role that can manage the listed resources.
2. `cd cloud/terraform`
3. Copy `terraform.tfvars.example` to `terraform.tfvars`. Set a unique S3 bucket name, strong database password, your trusted CIDR, and health URL (may be blank until hosting exists).
4. Run `terraform init`, `terraform validate`, `terraform plan`, then review carefully before `terraform apply`.
5. Terraform creates a VPC, internet gateway, two public subnets, two private subnets, security groups, a private RDS MySQL database, private/versioned S3 bucket, and Lambda health-check function.
6. The AWS account will incur charges. Review the AWS pricing for RDS, S3, Lambda, and networking before applying. `terraform destroy` removes Terraform-managed infrastructure; RDS deletion can destroy data.

## Connect Flask to RDS
Set `DATABASE_URL` in the backend environment:
`mysql+pymysql://USERNAME:URL_ENCODED_PASSWORD@RDS_ENDPOINT:3306/studycloud`
Use URL-encoded password characters. Keep the RDS database private. The app must be deployed inside the VPC or have secure network access to it.

## Connect Flask to S3
Set `AWS_REGION` and `S3_BUCKET`. Use IAM role credentials (recommended for AWS hosting), not hard-coded access keys. When `S3_BUCKET` is set, upload/download/delete operations use S3. Download links are short-lived presigned URLs (5 minutes). Without a bucket, local development uses `backend/uploads`.

## Important production notes
- Replace the example secrets. Never commit `.env` or `terraform.tfvars`.
- Restrict app ingress CIDRs and use HTTPS via a reverse proxy/load balancer.
- Add an app hosting service (ECS/Fargate, EC2, or Elastic Beanstalk) and assign an IAM role with least-privilege S3 access. This repository's Terraform provisions core network/storage/database/Lambda, not a production application host.
- Backups, monitoring, database migration/import, and production secret management must be configured before production use.
- SQLite data is not automatically migrated to RDS. Export/import or migration scripts are required before switching a live database.
