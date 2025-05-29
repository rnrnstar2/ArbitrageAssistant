#!/bin/bash

# S3 Bucket Public Access Policy Setup Script
# This script sets up the S3 bucket policy for public read access to release files

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${YELLOW}→ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

BUCKET_NAME="amplify-arbitrageassistantreleases"

print_info "Setting up S3 bucket policy for $BUCKET_NAME..."

# Check if bucket exists, create if not
if ! aws s3api head-bucket --bucket $BUCKET_NAME 2>/dev/null; then
    print_info "Bucket does not exist. Creating bucket..."
    aws s3api create-bucket --bucket $BUCKET_NAME --region ap-northeast-1 --create-bucket-configuration LocationConstraint=ap-northeast-1
    print_success "Bucket created successfully!"
else
    print_info "Bucket already exists"
fi

# Create bucket policy JSON
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/releases/*"
    }
  ]
}
EOF

# Remove public access block to allow bucket policy
print_info "Removing public access block..."
aws s3api delete-public-access-block --bucket $BUCKET_NAME

# Apply bucket policy
print_info "Applying bucket policy..."
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json

# Enable static website hosting
print_info "Enabling static website hosting..."
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document error.html

# Clean up temporary file
rm /tmp/bucket-policy.json

print_success "S3 bucket policy setup completed!"
print_info "Bucket URL: https://${BUCKET_NAME}.s3.ap-northeast-1.amazonaws.com/"
print_info "Updater endpoint: https://${BUCKET_NAME}.s3.ap-northeast-1.amazonaws.com/releases/hedge-system/latest.json"