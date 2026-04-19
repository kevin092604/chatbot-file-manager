# chatbot-file-manager

Sistema web de gestión de documentos para las vicerrectorías de la UNAH. Permite a cada vicerrectoría administrar los archivos Markdown/texto que alimentan a un chatbot basado en Amazon Bedrock, con auditoría completa de acciones.

## Stack

- **Frontend**: React 19 + Vite + Tailwind + AWS Amplify (Cognito auth)
- **Backend**: 4 Lambdas en Python 3.12
  - `chatbot-file-manager` — CRUD de archivos en S3, gestión de usuarios y grupos en Cognito
  - `chatbot-auditoria` — registra acciones en RDS SQL Server (`pymssql` + layer)
  - `chatbot-bedrock-sync` — sincroniza la Knowledge Base de Bedrock al cambiar archivos
  - `voae-user-manager-dev` — gestión auxiliar de usuarios Cognito
- **Infra AWS** (región `us-east-2`): S3, CloudFront, API Gateway, Cognito, Lambda en VPC, RDS SQL Server Express, Bedrock Knowledge Base
- **CI/CD**: GitHub Actions con OIDC hacia AWS (sin claves de larga duración)

## Levantar en local

```bash
cd frontend
cp .env.example .env   # completar con los IDs reales de Cognito y API
npm install
npm run dev
```

Para modo mock (sin Cognito), en `.env`:

```
VITE_AUTH_MOCK=true
```

Las Lambdas no se corren local — se editan en AWS directamente o se despliegan vía el workflow (ver abajo).

## Deploy

Automatizado con GitHub Actions. Cualquier push a `main` redeploya lo que cambió (path filters por Lambda y frontend):

- Cambios en `functions/<name>/handler.py` → redeploya esa Lambda.
- Cambios en `frontend/**` → build + sync a S3 + invalidación CloudFront.

También hay `workflow_dispatch` manual con selector de target (`all`, `frontend`, `auditoria`, etc.) en la pestaña **Actions** del repo.

Setup completo del workflow (IAM role, OIDC, secrets, variables): ver `docs/deploy-setup.md`.

## Estructura

```
.github/workflows/       workflow de CI/CD
docs/                    documentación de setup (gitignored)
frontend/                SPA React
functions/<name>/        Lambdas (una carpeta por función)
sql/                     schemas SQL de referencia (tabla auditoria)
```

## Estado

- **Infra dev/staging**: operativa en cuenta AWS personal.
- **Auditoría**: migrada de DynamoDB a RDS SQL Server (`voae-sql`, base `voae`, tabla `auditoria`).
- **Deploy automatizado**: funcionando, 4 Lambdas + frontend redeployables desde GitHub.
- **Pendiente**: migración de autenticación a Microsoft Entra ID (Azure AD) de la UNAH — bloqueado hasta recibir Tenant ID + Client ID.
- **Entrega final a UNAH**: planeada con Serverless Framework (Fase 2), bloqueada por lo mismo.
