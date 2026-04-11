#!/bin/bash
echo "Creando recursos en LocalStack..."

# Crear bucket S3
awslocal s3 mb s3://voae-docs
echo "Bucket voae-docs creado"

# Crear carpetas de vicerrectorias
for dir in voae vra vrip vrog; do
  awslocal s3api put-object --bucket voae-docs --key "$dir/"
  echo "Carpeta $dir/ creada"
done

# Crear tabla DynamoDB
awslocal dynamodb create-table \
  --table-name voae-auditoria \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=vicerrectoria,AttributeType=S \
    AttributeName=fecha,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    '[{
      "IndexName": "vicerrectoria-fecha-index",
      "KeySchema": [
        {"AttributeName": "vicerrectoria", "KeyType": "HASH"},
        {"AttributeName": "fecha", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }]'
echo "Tabla voae-auditoria creada"

echo "LocalStack listo!"
