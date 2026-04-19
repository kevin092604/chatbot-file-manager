IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'voae')
BEGIN
    CREATE DATABASE voae;
END
GO

USE voae;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'auditoria')
BEGIN
    CREATE TABLE auditoria (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        usuario         NVARCHAR(255)    NOT NULL,
        vicerrectoria   NVARCHAR(50)     NOT NULL,
        accion          NVARCHAR(50)     NOT NULL,
        archivo         NVARCHAR(500)    NOT NULL,
        fecha           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
        estado          NVARCHAR(20)     NOT NULL DEFAULT 'EXITOSO',
        detalle         NVARCHAR(MAX)    NULL,
        CONSTRAINT pk_auditoria PRIMARY KEY (id)
    );

    CREATE INDEX ix_auditoria_vicerrectoria_fecha
        ON auditoria (vicerrectoria, fecha DESC);

    CREATE INDEX ix_auditoria_fecha
        ON auditoria (fecha DESC);
END
GO
