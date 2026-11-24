# StudyCloud – Cloud Deployment Documentation

## 1. Project Overview
StudyCloud is a cloud-based learning platform designed to provide students with access to study materials and educational resources.

## 2. Cloud Infrastructure (AWS)
The project uses Amazon Web Services (AWS) for cloud infrastructure.

- **AWS Region:** Europe (Ireland) – `eu-west-1`
- **VPC:** StudyCloud-vpc
- **Amazon S3:** Used for storing uploaded learning materials.
- **Amazon RDS:** MySQL database for application data.
- **AWS Lambda:** Serverless health-check function.
- **IAM:** Identity and access management for AWS services.

## 3. Storage – Amazon S3
A private S3 bucket was created for StudyCloud materials.

- Bucket: `studycloud-materials-2026-chika`
- Storage: Study materials and uploaded files
- Access: Private
- Integration: Backend uses Boto3 to communicate with S3.

## 4. Database – Amazon RDS
StudyCloud uses Amazon RDS with MySQL.

- Instance identifier: `studycloud-db`
- Engine: MySQL
- Database: `studycloud`
- Region: EU (Ireland)
- Port: `3306`

The Flask backend is configured to use the database through the `DATABASE_URL` environment variable.

## 5. Backend
The backend is developed using Python and Flask.

- API port: `5000`
- Health endpoint: `/api/health`
- Environment configuration: `.env`
- Database configuration: environment variables
- File storage integration: Amazon S3

## 6. AWS Lambda
A Lambda function named `studycloud-health-check` was deployed.

The function returns a successful health-check response confirming that the serverless function is operational.

## 7. Docker Configuration
Docker configuration is included for container deployment.

Files:
- `Dockerfile`
- `docker-compose.yml`

Docker Compose configuration:
- Builds the backend container.
- Maps port `5000`.
- Loads environment variables from `.env`.
- Persists uploaded files using a Docker volume.
- Uses a restart policy to improve availability.

Local Docker execution was not performed.

## 8. Environment Variables
Sensitive configuration is stored in `.env` and should not be committed to Git.

Configuration includes:
- AWS credentials
- AWS region
- S3 bucket name
- Database connection URL
- Secret keys

## 9. Health Check
The backend health endpoint:

`http://127.0.0.1:5000/api/health`

Expected response:

```json
{
  "application": "StudyCloud",
  "status": "healthy"
}
```

The Lambda test was also executed successfully through the AWS Console.

## 10. Deployment Summary
StudyCloud cloud infrastructure has been configured with AWS S3 storage, Amazon RDS MySQL, AWS Lambda, IAM, and Flask backend integration. Docker configuration is prepared to support containerized deployment.

The backend health endpoint and Lambda function were successfully tested.
