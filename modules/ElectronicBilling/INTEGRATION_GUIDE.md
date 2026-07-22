# Guía de Integración con Sistemas ERP / Externos

Esta guía describe cómo integrar el módulo autónomo `ElectronicBilling` en cualquier aplicación .NET o sistema ERP.

## Opciones de Integración

### Opción A: Integración Directa como Librería .NET (Recomendada)

1. **Agregar Referencia de Proyecto / Paquete**:
   Inserte la referencia a `ElectronicBilling.Core`, `ElectronicBilling.Sri`, `ElectronicBilling.Application` y `ElectronicBilling.Infrastructure`.

2. **Registrar Servicios en el Contenedor IoC (`Program.cs` / `Startup.cs`)**:
   ```csharp
   using ElectronicBilling.Api.Extensions;

   builder.Services.AddElectronicBillingModule(builder.Configuration.GetConnectionString("DefaultConnection"));
   ```

3. **Uso de Adaptador en el ERP (Ej. `ErpElectronicBillingAdapter`)**:
   ```csharp
   // Transformar entidad Venta del ERP a solicitud estándar
   ElectronicInvoiceRequest request = ErpElectronicBillingAdapter.ToElectronicInvoiceRequest(sale, client, companySetting);

   // Inyectar y llamar servicio
   var result = await _electronicBillingService.EmitInvoiceAsync(request, p12Bytes, p12Password);

   if (result.Success)
   {
       Console.WriteLine($"Factura autorizada. Clave: {result.AccessKey}");
   }
   ```

### Opción B: Integración HTTP REST API (Microservicio)

Ejecute la API REST de `ElectronicBilling.Api` en un contenedor Docker o servidor independiente:

```http
POST /api/v1/electronic-billing/emit
Content-Type: application/json

{
  "tenantId": "empresa_001",
  "issuer": {
    "ruc": "0929433514001",
    "socialReason": "JC TECH SOLUCIONES",
    "mainAddress": "Guayaquil",
    "environment": 1
  },
  "establishment": {
    "code": "001",
    "emissionPointCode": "001",
    "address": "Guayaquil"
  },
  "customer": {
    "identificationType": 2,
    "identificationNumber": "0929433514",
    "socialReason": "Cliente Ejemplo",
    "address": "Guayaquil",
    "email": "cliente@ejemplo.com"
  },
  "lines": [
    {
      "itemCode": "PROD-1",
      "description": "Producto de Ejemplo",
      "quantity": 1,
      "unitPrice": 100.00,
      "taxes": [
        {
          "taxType": 1,
          "percentageCode": "4",
          "rate": 15.0,
          "taxableBase": 100.00
        }
      ]
    }
  ],
  "payments": [
    {
      "paymentMethod": 1,
      "total": 115.00
    }
  ]
}
```
