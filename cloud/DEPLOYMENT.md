# Deployment and AWS Setup Guide

## Environment values
Required for cloud:
- `SECRET_KEY`, `JWT_SECRET_KEY`
- `DATABASE_URL` (`mysql+pymysql://...`)
- `AWS_REGION`
- `S3_BUCKET`

Local mode omits `DATABASE_URL` and `S3_BUCKET`, and uses SQLite plus `backend/uploads`.

## AWS resources (Terraform)
Terraform files in `cloud/terraform` describe the VPC, subnet layout, security groups, private RDS MySQL, private/versioned S3 bucket, and Lambda health check. Review `terraform plan` and pricing before applying. Store passwords outside source control.

## Docker backend
Build/run from `backend`:
- `cp .env.example .env` (edit values)
- `docker compose up --build`

## S3 object layout
Uploaded materials are stored as `materials/<student_id>/<random-file-id>.<ext>`. Bucket access is private; download route returns a five-minute presigned URL after JWT ownership validation.

## RDS
The MySQL DB is named `studycloud`. Configure the app with a SQLAlchemy MySQL URL. RDS remains private; the application host must be in the VPC or connected securely.

## Lambda
`cloud/lambda/health_check.py` returns a simple ready response or optionally checks the API health endpoint. Terraform deploys it as `studycloud-health-check`.

## SQLite migration
This implementation does not automatically migrate the existing SQLite data. For a project/demo, provision RDS, export SQLite data, import into MySQL with a schema-compatible migration tool, then set `DATABASE_URL`. Test with a copy of the data first.
