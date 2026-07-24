# Módulo Autónomo de Facturación Electrónica SRI (Ecuador)

Este repositorio contiene un módulo autónomo, desacoplado y reutilizable en **.NET 9** para la generación, firma digital (XAdES-BES), validación, almacenamiento e integración de comprobantes electrónicos con el **SRI de Ecuador**.

## Características Principales

- **Arquitectura Limpia (Clean Architecture)**: Separación estricta en capas (Core, Application, Sri, Infrastructure, Api).
- **Generación de Clave de Acceso**: Algoritmo Módulo 11 oficial del SRI (49 dígitos).
- **Generador de XML SRI v1.1.0**: Soporte completo para Facturas electrónicas con desglose tributario (IVA 15%, 12%, 0%).
- **Firmador XAdES-BES Estándar**: Firma digital PKCS#12 (.p12/.pfx) conforme a la especificación técnica del SRI (SignedProperties, KeyInfo, DigestValue, SignatureValue).
- **Validador de Firma XML**: Verificación independiente de integridad criptográfica de firmas.
- **Cliente SOAP SRI**: Envío directo a los WebServices de Recepción y Autorización del SRI.
- **Gestión de Secuenciales e Idempotencia**: Control concurrente multiempresa/multitenant sin colisiones.
- **Sin Dependencias de ERP Externo**: Puede ser consumido como API REST independiente o integrado en cualquier sistema a través de contratos standard.

## Estructura de la Solución

```
modules/ElectronicBilling/
├── ElectronicBilling.sln
├── src/
│   ├── ElectronicBilling.Core/           # Entidades, Interfaces y Contratos DTO
│   ├── ElectronicBilling.Application/    # Casos de uso e Idempotencia
│   ├── ElectronicBilling.Sri/            # Generación XML, Firma XAdES-BES y SOAP SRI
│   ├── ElectronicBilling.Infrastructure/ # Persistencia EF Core, PDF RIDE y Notificaciones
│   └── ElectronicBilling.Api/            # Endpoints REST y Extensiones IoC
├── tests/
│   └── ElectronicBilling.Tests/          # Suite completa de pruebas unitarias
├── README.md
├── DOCUMENTATION.md
├── INTEGRATION_GUIDE.md
└── .env.example
```

## Requisitos Previos

- **SDK de .NET 9.0** o superior.
- Motor de base de datos relacional (PostgreSQL / SQLite / SQL Server via EF Core).
- Certificado digital `.p12` de firma electrónica emitido por una entidad de certificación autorizada (Security Data, BCE, ANF, etc.).

## Inicio Rápido

```bash
# Compilar el módulo
dotnet build ElectronicBilling.sln

# Ejecutar las pruebas unitarias
dotnet test ElectronicBilling.sln
```
