# Documentación Técnica del Módulo de Facturación Electrónica SRI

## Arquitectura y Capas

### 1. `ElectronicBilling.Core`
Contiene los contratos agnósticos, enumeraciones y entidades dominantes del módulo:
- `ElectronicInvoiceRequest`: Contrato universal para solicitar la emisión de una factura.
- `IssuerData`, `EstablishmentData`, `CustomerData`, `InvoiceLine`, `TaxDetail`, `PaymentDetail`.
- Interfaces clave: `IElectronicBillingService`, `ISriXmlSigner`, `ISriXmlSignatureValidator`, `ISriSoapClient`, `ISequenceManager`, `ICertificateManager`.

### 2. `ElectronicBilling.Sri`
Implementa la lógica del dominio tributario de Ecuador:
- `AccessKeyGenerator`: Genera la clave de 49 dígitos aplicando el algoritmo Módulo 11 con ponderación 7..2.
- `SriXmlBuilder`: Construye el XML de factura formato `1.1.0` con la estructura oficial del SRI.
- `SriXadesBesSigner`: Firma comprobantes usando certificados `.p12` mediante algoritmos SHA256 y RSA. Inserta el nodo `<xades:QualifyingProperties>` con `<xades:SignedProperties>` y `<ds:KeyInfo>`.
- `SriXmlSignatureValidator`: Valida criptográficamente el hash digest y la firma contra la clave pública del certificado.
- `SriSoapClient`: Consume los servicios SOAP del SRI para recepción (`validarComprobante`) y autorización (`autorizacionComprobante`).

### 3. `ElectronicBilling.Infrastructure`
Provee los servicios de persistencia e infraestructura:
- `ElectronicBillingDbContext`: Contexto Entity Framework Core para `ElectronicDocument`, `EmissionPointSequence` y `TenantSetting`.
- `SequenceManager`: Garantiza asignación atómica e incremental de secuenciales (formato `001-001-000000001`).
- `CertificateManager`: Cifrado y descifrado seguro de certificados digitales y contraseñas.
- `RidePdfGenerator`: Generador RIDE de factura en formato PDF.

### 4. `ElectronicBilling.Application`
Coordina los casos de uso:
- `ElectronicBillingService`: Orquesta el flujo completo (secuencial -> clave de acceso -> construcción XML -> firma XAdES-BES -> envío SRI -> almacenamiento -> notificación).
- `IdempotencyChecker`: Evita doble emisión para la misma transacción o pedido.

### 5. `ElectronicBilling.Api`
Expone los controladores HTTP REST:
- `POST /api/v1/electronic-billing/emit`: Emite un comprobante a partir de un `ElectronicInvoiceRequest`.
- `GET /api/v1/electronic-billing/xml/{accessKey}`: Obtiene el XML firmado o autorizado.
- `GET /api/v1/electronic-billing/status/{accessKey}`: Consulta el estado en el SRI.
