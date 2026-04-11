# Prompt — Sistema de Gestión de Archivos VOAE / UNAH

## Contexto del Proyecto
Sistema interno para que las vicerrectorías de la UNAH puedan subir, editar y eliminar archivos `.md` que alimentan una Knowledge Base de Amazon Bedrock (la KB ya existe y es administrada por otro equipo). Este sistema **no maneja embeddings ni consultas al chatbot** — solo gestiona los archivos fuente y dispara la sincronización.

---

## Lo que hace el sistema
1. El personal administrativo de cada vicerrectoría inicia sesión en un panel web.
2. Puede subir `.md` nuevos, editar los existentes o eliminarlos — únicamente dentro de su carpeta en S3.
3. Cada cambio dispara automáticamente un `StartIngestionJob` en Bedrock para sincronizar la KB.
4. Cada acción queda registrada en una tabla de auditoría en DynamoDB.
5. Hay un panel de auditoría donde cada vicerrectoría ve sus propios registros y el superadmin ve todo.

---

## Arquitectura AWS

| Servicio | Rol |
|---|---|
| S3 (frontend) | Sirve el build estático de React |
| S3 (docs) | Almacena los `.md` organizados por carpeta de vicerrectoría |
| Cognito | Autenticación + grupos por vicerrectoría |
| API Gateway | Entrada segura, valida JWT de Cognito automáticamente |
| Lambda x3 | Lógica del sistema |
| Bedrock KB | Solo recibe el trigger de sync (KB existente, otro equipo) |
| DynamoDB | Tabla de auditoría |

---

## Estructura S3 (docs)

```
voae-knowledge-base/
├── voae/
├── vra/
├── vrip/
├── vrog/
└── .../
```

Cada vicerrectoría solo puede leer y escribir en su propia carpeta. Esto se enforza con IAM Policies a nivel de bucket (no solo en la Lambda).

---

## Seguridad — Cognito + IAM

```
Cognito Groups
├── voae   → IAM Role → Policy: acceso solo a voae/*
├── vra    → IAM Role → Policy: acceso solo a vra/*
├── vrip   → IAM Role → Policy: acceso solo a vrip/*
└── admin  → IAM Role → Policy: acceso a todo el bucket
```

Las Lambdas no validan autenticación — API Gateway ya lo hace. Las Lambdas solo leen el usuario y grupo desde el evento inyectado por API Gateway:

```python
claims = event['requestContext']['authorizer']['claims']
usuario = claims['email']
vicerrectoria = claims['cognito:groups']
```

---

## Las 3 Lambdas (Python 3.12)

### 1. file_manager
Operaciones sobre archivos `.md` en S3. Al completar cualquier operación exitosa invoca `bedrock_sync` y `auditoria`.

- `list` — lista los `.md` de la carpeta de la vicerrectoría del usuario
- `get` — obtiene el contenido de un `.md` para editarlo
- `upload` — sube un `.md` nuevo
- `update` — actualiza un `.md` existente
- `delete` — elimina un `.md`

### 2. bedrock_sync
Solo dispara `StartIngestionJob` en Bedrock. Separada porque es reutilizable y puede ser invocada por otros sistemas en el futuro.

```python
bedrock.start_ingestion_job(
    knowledgeBaseId='KB_ID',
    dataSourceId='DS_ID'
)
```

### 3. auditoria
Escribe y consulta registros en DynamoDB.

- `write` — registra una acción
- `get` — consulta registros (filtrado por vicerrectoría si no es admin)

---

## Registro de Auditoría (DynamoDB)

```json
{
  "id": "uuid",
  "usuario": "juan@unah.edu.hn",
  "vicerrectoria": "voae",
  "accion": "ACTUALIZAR",
  "archivo": "Becas_UNAH.md",
  "fecha": "2026-04-09T10:32:00",
  "estado": "EXITOSO",
  "detalle": ""
}
```

---

## Frontend (React)

### Stack
| Parte | Tecnología |
|---|---|
| Framework | React |
| Auth | AWS Amplify (maneja Cognito, JWT y sesiones) |
| Editor .md | react-simplemde-editor |
| Tabla auditoría | react-table |
| Estilos | Tailwind CSS |
| Deploy | npm run build → S3 estático |

### Panel
```
Panel Admin
├── 🔐 Login (Cognito via Amplify)
│
├── 📁 Archivos
│   ├── Lista de .md de su vicerrectoría
│   ├── Subir .md nuevo
│   ├── Editar .md (react-simplemde-editor)
│   └── Eliminar .md
│
├── 📊 Auditoría
│   ├── Tabla de registros (react-table)
│   ├── Filtros (fecha, usuario, acción)
│   └── Exportar Excel (solo admin)
│
└── ⚙️ Admin (solo superadmin)
    ├── Ver todas las vicerrectorías
    └── Gestionar usuarios
```

### Roles y permisos en el panel
| Sección | Editor (vicerrectoría) | Superadmin |
|---|---|---|
| Archivos | Solo su carpeta | Todas |
| Auditoría | Solo sus registros | Todos |
| Exportar Excel | ❌ | ✅ |
| Gestionar usuarios | ❌ | ✅ |

---

## Flujo Completo

```
1. AUTENTICACIÓN
─────────────────
Usuario abre el panel
        ↓
Amplify muestra login
        ↓
Cognito valida credenciales
        ↓
Devuelve JWT con usuario + grupo (vicerrectoría)
        ↓
Amplify guarda el token automáticamente

2. OPERACIÓN DE ARCHIVO
────────────────────────
Usuario sube/edita/elimina un .md
        ↓
React manda request a API Gateway con JWT en el header
        ↓
API Gateway valida el token con Cognito
        ↓
Lambda recibe evento con usuario + grupo ya validados
        ↓
file_manager verifica que el archivo pertenece
a la carpeta de su vicerrectoría
        ↓
Opera en S3 (solo su carpeta)
        ↓
Invoca bedrock_sync → StartIngestionJob
        ↓
Invoca auditoria → escribe registro en DynamoDB
        ↓
Responde al frontend con éxito/error

3. CONSULTA DE AUDITORÍA
─────────────────────────
Usuario abre pestaña Auditoría
        ↓
React llama a API Gateway
        ↓
Lambda auditoria consulta DynamoDB
        ↓
Filtra por vicerrectoría si no es admin
        ↓
Devuelve registros al frontend
        ↓
react-table los muestra con filtros y paginación
```

---

## Estructura del Proyecto Local

```
voae-system/
├── functions/
│   ├── file_manager/
│   │   ├── handler.py
│   │   ├── test_handler.py
│   │   └── requirements.txt
│   ├── bedrock_sync/
│   │   ├── handler.py
│   │   ├── test_handler.py
│   │   └── requirements.txt
│   └── auditoria/
│       ├── handler.py
│       ├── test_handler.py
│       └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   ├── package.json
│   └── tailwind.config.js
├── tests/
│   └── sample_files/
│       └── Becas_UNAH.md
└── .env
```

---

## Orden de Implementación

### Fase 1 — Local
```
1. file_manager    → lógica S3 con LocalStack
2. bedrock_sync    → mock local
3. auditoria       → DynamoDB con LocalStack
4. Frontend React  → con mocks de API
```

### Fase 2 — AWS
```
5.  Cognito        → usuarios y grupos
6.  IAM            → roles y políticas por vicerrectoría
7.  S3             → buckets y carpetas
8.  DynamoDB       → tabla auditoría
9.  Lambdas        → deploy
10. API Gateway    → endpoints + authorizer de Cognito
11. Frontend       → npm run build → deploy a S3
```

---

## Notas Importantes
- Las Lambdas **no validan autenticación** — eso es responsabilidad de API Gateway + Cognito.
- La seguridad de carpetas se enforza en **dos niveles**: IAM Policy en S3 + verificación en la Lambda.
- El gasto de Bedrock (embeddings, modelo, vector store) **no pertenece a este sistema** — solo se dispara un `StartIngestionJob` que tiene costo mínimo.
- Los archivos `.md` deben respetar el formato estándar de la VOAE (plantilla disponible en `Plantilla_Actualizacion_VOAE.md`).
- Usar **LocalStack** para simular S3 y DynamoDB en local antes de tocar AWS.
- `bedrock_sync` se mockea en local ya que Bedrock no tiene emulador local.
