# 🇪🇨 Guía Completa — Facturación Electrónica SRI
## Sistema ERP-STORE-FAST | RIMPE Negocio Popular

> **Documento unificado:** Estado del código + Trámites SRI + IVA + Flujo del sistema + Correo de notificaciones.
> Fecha: Abril 2026

---

## PARTE 1 — Veredicto Definitivo: IVA para RIMPE Negocio Popular

> [!IMPORTANT]
> **VEREDICTO: Los contribuyentes RIMPE Negocio Popular NO cobran IVA. Sus facturas siempre se emiten al 0% de IVA.**

### Sustento legal

| Régimen | ¿Cobra IVA? | ¿Obliga Factura Electrónica? | Comprobante permitido |
|---|---|---|---|
| **RIMPE Negocio Popular** (tú) | ❌ **NO — 0% IVA** | ❌ No obligado (voluntario) | Nota de venta física O factura electrónica |
| RIMPE Emprendedor | ✅ Sí cobra IVA | ✅ SÍ obligado | Solo factura electrónica |
| Régimen General | ✅ Sí cobra IVA | ✅ SÍ obligado | Solo factura electrónica |

### Lo que dice el SRI textualmente
- El Negocio Popular **no está obligado** a emitir comprobantes electrónicos.
- Puede seguir usando **notas de venta físicas** preimpresas.
- Si elige voluntariamente emitir facturas electrónicas (como es tu caso con el ERP), debe hacerlo con **IVA 0%**.
- Todos los comprobantes deben incluir la leyenda obligatoria: **"Contribuyente RIMPE – Negocio Popular"**

### ¿Cómo está configurado en tu ERP?

✅ **Correcto.** Tu sistema ya maneja esto perfectamente:
- Si el régimen es `RIMPE_NEGOCIO_POPULAR`, el XML se emite con `<tarifa>0.00</tarifa>` y `<codigoPorcentaje>0</codigoPorcentaje>`.
- La leyenda RIMPE se incluye automáticamente en el XML y en el RIDE (PDF).
- El ticket térmico muestra: `"CONTRIBUYENTE RÉGIMEN RIMPE / NEGOCIO POPULAR - NO COBRA IVA"`.
- El campo "Tasa IVA" en Configuración es ignorado para Negocio Popular (siempre usará 0%).

---

## PARTE 2 — Estado Real del Código en tu ERP

### ✅ Qué está 100% implementado

**Backend:**
- Entidades `CompanySetting`, `Sale`, `Client` con todos los campos de FE
- Migration de base de datos aplicada
- `ElectronicBillingService.cs` (~752 líneas) con:
  - Generación Clave de Acceso 49 dígitos (Módulo 11) ✅
  - Generación XML SRI v2.1.0 completo ✅
  - Comunicación SOAP con SRI Pruebas y Producción ✅
  - Consulta y parseo de autorización ✅
  - Generación RIDE (PDF) con QuestPDF + QR ✅
- `ElectronicBillingController.cs` con 6 endpoints ✅
- Upload del `.p12` hacia carpeta segura `private/signatures/` ✅

**Frontend:**
- Panel completo de Facturación Electrónica en Configuración ✅
- Toggle "Factura Electrónica" en el Punto de Venta ✅
- Columna "FE" con badges de estado en Historial de Ventas ✅
- Descarga XML y RIDE desde el historial ✅
- Ticket térmico con datos de autorización SRI ✅

### ❌ El único código pendiente

```
FirmarXml() — ElectronicBillingService.cs, líneas 339–357
```

Esta función siempre lanza una excepción. Aunque cargues el `.p12`, ninguna factura puede enviarse al SRI hasta implementar esta función. Ver **Parte 5** para el código.

---

## PARTE 3 — Obtener tu Firma Electrónica (.p12)

La firma electrónica es el archivo que permite firmar digitalmente los XML antes de enviarlos al SRI. Sin ella, no puedes emitir.

### Opciones disponibles en Ecuador

| Proveedor | Tipo | Precio ref. | Web | Tiempo |
|---|---|---|---|---|
| **Banco Central (BCE)** | Archivo `.p12` | ~$31 (primera vez) | [eci.bce.ec](https://www.eci.bce.ec) | 1-2 días hábiles |
| **Security Data** | Archivo `.p12` | ~$25-40 | [securitydata.net.ec](https://registro.securitydata.net.ec) | Puede ser en horas |
| **ANF Ecuador** | Archivo `.p12` | Similar | [anf.es/ec](https://www.anf.es) | 1-2 días |

> **TIP:** Para **facturación electrónica**, el formato **Archivo (.p12)** es suficiente y más económico. NO necesitas el Token USB.

### Requisitos para personas naturales (Negocio Popular)

1. 📄 Cédula de identidad vigente y a color
2. 📋 Papeleta de votación actualizada
3. 🏢 Tu RUC activo como RIMPE Negocio Popular
4. 💳 Pago en línea con tarjeta de crédito/débito

### Pasos para obtenerla en el BCE (recomendado)

```
1. Ve a: https://www.eci.bce.ec
2. Haz clic en "Solicitar firma electrónica"
3. Selecciona: Persona Natural
4. Sube los documentos solicitados
5. Paga en línea (~$31)
6. Descarga el archivo .p12 cuando te lo envíen por correo
7. Guarda la CONTRASEÑA que asignaste — la necesitarás siempre
```

> **⚠ IMPORTANTE:** Guarda la contraseña del `.p12` en un lugar seguro. Si la pierdes, deberás obtener una nueva firma (pagando nuevamente). Tu ERP guardará esta contraseña en la base de datos.

---

## PARTE 4 — Habilitación en el Portal SRI

Una vez que tengas tu `.p12`, debes registrarte en el SRI para emitir comprobantes electrónicos.

### Paso A — Verificar tu RUC y estado RIMPE

```
1. Ve a: https://srienlinea.sri.gob.ec
2. Consulta tu RUC → Verifica que diga "RIMPE – NEGOCIO POPULAR"
3. Si no estás activo como RIMPE, debes regularizarte primero
```

### Paso B — Habilitar Ambiente de PRUEBAS (Certificación)

> **NOTA:** El ambiente de pruebas es **GRATUITO**, no genera obligación tributaria y es donde debes comenzar.

```
1. Ingresa a: https://srienlinea.sri.gob.ec
   → Usa tu RUC y contraseña del portal SRI

2. En el menú principal → busca "Facturación Electrónica"

3. Selecciona: Comprobantes Electrónicos → Pruebas → Autorización

4. Haz clic en "Solicitud de emisión"

5. Haz clic en "Siguiente"

6. Se generará un PDF de confirmación → descárgalo y guárdalo

7. Luego ve a:
   Pruebas → "Solicitud de inclusión de comprobantes"

8. Selecciona los tipos de comprobantes:
   ✅ Facturas
   ✅ Notas de crédito (opcional)
   (Para Negocio Popular no se necesitan retenciones)

9. Confirma la solicitud
   → Quedarás habilitado para pruebas INMEDIATAMENTE
```

### Paso C — URLs del ambiente de pruebas

Tu ERP ya tiene estas URLs hardcodeadas (listas para usar):
```
Recepción:    https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline
Autorización: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
```

### Paso D — Habilitar Ambiente de PRODUCCIÓN (cuando estés listo)

> **⚠ PRECAUCIÓN:** Los comprobantes en Producción tienen **validez legal y tributaria**. Solo pasa a producción cuando hayas probado exhaustivamente.

```
1. Mismo portal: https://srienlinea.sri.gob.ec

2. Facturación Electrónica → Producción → Autorización

3. Solicitud de emisión → Siguiente

4. Solicitud de inclusión de comprobantes → Facturas

5. Confirmar → PDF de autorización

6. En tu ERP: Configuración → Ambiente → cambiar a "Producción"
```

---

## PARTE 5 — Implementar el Código Pendiente: FirmarXml()

Antes de probar con el SRI, debes implementar la firma digital.

### Paso 1 — Instalar NuGet

Ejecuta en la carpeta `backend-api/`:

```powershell
dotnet add package FirmaXadesNet --version 2.0.5
```

### Paso 2 — Agregar usings al archivo

En `backend-api/ErpStore.Infrastructure/Services/ElectronicBillingService.cs`, agrega al inicio:

```csharp
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using FirmaXadesNet;
```

### Paso 3 — Reemplazar FirmarXml()

Reemplaza las **líneas 339–357** con este código completo:

```csharp
private Task<string> FirmarXml(string xmlContent, CompanySetting company)
{
    if (string.IsNullOrEmpty(company.ElectronicSignaturePath) ||
        !File.Exists(company.ElectronicSignaturePath))
    {
        throw new InvalidOperationException(
            "Firma electrónica no configurada. " +
            "Por favor sube tu archivo .p12 en Configuración → Facturación Electrónica.");
    }

    if (string.IsNullOrEmpty(company.ElectronicSignaturePassword))
    {
        throw new InvalidOperationException(
            "Contraseña de la firma electrónica no configurada.");
    }

    try
    {
        var certificate = new X509Certificate2(
            company.ElectronicSignaturePath,
            company.ElectronicSignaturePassword,
            X509KeyStorageFlags.Exportable | X509KeyStorageFlags.PersistKeySet
        );

        var firmador = new FirmaXadesNet.Firma();
        var xmlFirmado = firmador.FirmarDocumento(xmlContent, certificate);

        return Task.FromResult(xmlFirmado);
    }
    catch (CryptographicException ex)
    {
        throw new InvalidOperationException(
            $"Error al cargar la firma .p12. Verifica la contraseña: {ex.Message}");
    }
    catch (Exception ex)
    {
        throw new InvalidOperationException(
            $"Error al firmar el documento XML: {ex.Message}");
    }
}
```

### Paso 4 — Compilar

```powershell
dotnet build ErpStore.Api.csproj
```

✅ Debe compilar con 0 errores.

---

## PARTE 6 — Cómo Funciona el ERP para Emitir Facturas

### 6.1 — Configuración inicial (solo una vez)

```
📍 Ve a: ERP → Configuración → Facturación Electrónica SRI

1. Activar toggle "Activar Facturación Electrónica" → ON
2. Régimen Tributario → "RIMPE – Negocio Popular"
3. Ambiente SRI → "🟡 Pruebas (Certificación)"  ← empieza aquí
4. Tasa IVA → déjala en 15% (es ignorada para Negocio Popular, siempre será 0%)
5. Nombre Comercial → pon tu nombre de negocio
6. Establecimiento → "001"
7. Punto de Emisión → "001"
8. Secuencial Actual → "0" (la próxima factura será la #1)
9. Clic en "Cargar Firma" → selecciona tu .p12 → ingresa contraseña → "Cargar Firma"
   ✅ Debería aparecer badge verde "Firma Configurada ✓"
10. Clic en "Guardar Config. FE"
```

### 6.2 — Flujo de emisión en el Punto de Venta

```
📍 Ve a: ERP → Punto de Venta (Caja)

1. Selecciona los productos del carrito
2. Selecciona el cliente:
   - "Consumidor Final" (toggle azul) → para ventas sin datos del cliente
   - O busca un cliente con CI/RUC registrado → para facturas a nombre específico

3. Método de pago → Efectivo o Transferencia

4. Toggle "Factura Electrónica" (parte inferior del carrito):
   ┌──────────────────────────────────────────┐
   │  📄 Factura Electrónica        [ ON/OFF ]│
   └──────────────────────────────────────────┘
   → Actívalo ANTES de procesar la venta si quieres emitir FE

5. Clic en "Completar Venta"

6. El sistema automáticamente:
   a) Registra la venta en la BD
   b) Genera la Clave de Acceso de 49 dígitos
   c) Genera el XML SRI v2.1.0
   d) Firma el XML con tu .p12 (XAdES-BES)
   e) Envía al Web Service SRI por SOAP
   f) Consulta la autorización
   g) Muestra el resultado en pantalla:
      ✅ "Factura Autorizada por el SRI" + número de autorización
      ⚠  O el error específico si algo falló

7. Pantalla de éxito:
   ┌─────────────────────────────────┐
   │  ✅ ¡Venta Exitosa!             │
   │  ✅ Factura Autorizada por SRI  │
   │  [Ver Detalles / Imprimir]      │
   │  [Nueva Venta]                  │
   └─────────────────────────────────┘
```

### 6.3 — Consultar estado y descargar documentos

```
📍 Ve a: ERP → Historial de Ventas

Columna "FE" (Facturación Electrónica):
  🟢 AUTORIZADO    → El SRI validó y autorizó la factura
  🟡 PENDIENTE     → Enviada, esperando respuesta del SRI
  🟠 NO_AUTORIZADO → El SRI la rechazó (ver el error)
  🔴 ERROR         → Error de sistema (firma, conexión, etc.)
  —                → Venta normal sin FE

Botones en la columna "Acciones":
  🔵 [⬇] → Descarga el XML autorizado
  🟣 [📄] → Descarga el RIDE (PDF oficial del SRI)
```

### 6.4 — Ticket térmico (impresión 80mm)

Cuando imprimes desde el historial o desde el POS:
- Si la venta tiene FE autorizada → imprime **"FACTURA"** con todos los datos del SRI
- Si no tiene FE → imprime **"Ticket de Venta"** normal
- La sección SRI incluye: número de autorización, clave de acceso (en bloques), fecha de autorización, leyenda RIMPE

---

## PARTE 7 — ¿Necesitas el Correo para las Notificaciones de Stock?

> **IMPORTANTE:** El correo NO es obligatorio para usar la Facturación Electrónica. Son sistemas independientes.

### ¿Para qué sirve el correo en el ERP?

El sistema de correo (SMTP o Brevo) en Configuración → "Correo Saliente" sirve **exclusivamente** para:
- ✉ Enviar alertas automáticas de **stock bajo** a tu correo cuando un producto llega al mínimo
- ✉ No tiene relación con la FE ni con el SRI

### ¿Necesitas configurarlo?

| Escenario | ¿Necesitas correo? |
|---|---|
| Quiero emitir facturas electrónicas | ❌ No, no es necesario |
| Quiero recibir alertas cuando el stock baje | ✅ Sí, configúralo |
| Quiero las dos cosas | ✅ Configúralo |

### Cómo configurar el correo para alertas de stock

```
📍 Ve a: ERP → Configuración → Configuración de Correo Saliente

Opción A — Brevo (RECOMENDADO, gratuito 300 correos/día):
  1. Ve a: https://app.brevo.com/settings/keys/api
  2. Crea una cuenta gratuita (no requiere tarjeta de crédito)
  3. Obtén tu API Key (empieza con "xkeysib-...")
  4. Pégala en el campo "Brevo API Key"
  5. En "Correo Remitente", pon tu email
  6. Clic en "Guardar Configuración"
  7. Prueba con "Enviar Correo de Prueba"

Opción B — Gmail (SMTP):
  1. En tu cuenta de Gmail → Seguridad → Verificación en 2 pasos (activar)
  2. Seguridad → Contraseñas de aplicaciones → Generar para "Mail"
  3. En el ERP:
     - Servidor SMTP: smtp.gmail.com
     - Puerto: 587
     - Correo Remitente: tu-correo@gmail.com
     - Contraseña: la contraseña de aplicación (no tu contraseña normal)
  4. "Guardar Configuración" → "Enviar Correo de Prueba"
```

> **NOTA:** Brevo es la opción más confiable porque funciona aunque tu ISP bloquee los puertos SMTP (común en redes de Ecuador).

---

## PARTE 8 — Checklist Final para Poner en Marcha

### Fase 0 — Código (hacer UNA SOLA VEZ)
- [ ] Instalar NuGet: `dotnet add package FirmaXadesNet --version 2.0.5`
- [ ] Reemplazar `FirmarXml()` con el código de la Parte 5
- [ ] Compilar: `dotnet build ErpStore.Api.csproj` → 0 errores

### Fase 1 — Trámites externos
- [ ] Obtener firma `.p12` (BCE o Security Data, ~$31)
- [ ] Ingresar al portal SRI y solicitar habilitación en **Pruebas**
- [ ] Verificar PDF de autorización del SRI

### Fase 2 — Configurar el ERP
- [ ] Cargar `.p12` en Configuración → badge verde "Firma Configurada ✓"
- [ ] Seleccionar Régimen: "RIMPE – Negocio Popular"
- [ ] Seleccionar Ambiente: "🟡 Pruebas"
- [ ] Guardar Config. FE

### Fase 3 — Pruebas
- [ ] Hacer una venta de prueba con el toggle FE activado
- [ ] Verificar respuesta: "AUTORIZADO" con número de autorización
- [ ] Descargar XML y RIDE (PDF)
- [ ] Imprimir ticket con datos SRI
- [ ] Repetir con cliente específico (CI/RUC)

### Fase 4 — Producción (cuando todo esté probado)
- [ ] Solicitar habilitación en **Producción** en el portal SRI
- [ ] Cambiar Ambiente a "🟢 Producción" en el ERP
- [ ] Resetear Secuencial a 0
- [ ] Guardar Config. FE
- [ ] ¡Listo para emitir facturas con validez legal! 🇪🇨

---

## Resumen Visual

```
TU SITUACIÓN: RIMPE Negocio Popular
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IVA EN FACTURAS:        0% siempre ✅ (ya configurado)
OBLIGACIÓN FE:          Voluntaria (ya decidiste usarla) ✅
LEYENDA EN COMPROBANTE: RIMPE - Negocio Popular ✅

CÓDIGO ERP:             99% listo — solo falta FirmarXml()
FIRMA .p12:             Pendiente de obtener (~$31 BCE)
HABILITACIÓN SRI:       Pendiente (gratis, online, 5 min)
CORREO NOTIF. STOCK:    Independiente de la FE, opcional

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIEMPO ESTIMADO PARA ESTAR OPERATIVO: 1-3 días hábiles
  (dependiendo de cuánto tarde el BCE en emitir el .p12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## PARTE 9 — Nuevas Normativas SRI (Resolución NAC-DGERCGC26-00000027) y Correcciones Técnicas del RIDE

> **Actualización técnica y tributaria:** Septiembre 2026

### 1. Resolución SRI Nro. NAC-DGERCGC26-00000027 (RUC de Proveedor de Software)

A finales de julio de 2026, el Servicio de Rentas Internas emitió la **Resolución NAC-DGERCGC26-00000027** (incorporada en la Ficha Técnica SRI v2.34), con entrada en vigor tras 60 días calendario (finales de septiembre de 2026):

#### A. Alcance de la Obligación:
* **Para emisores que usan software de terceros:** Es **obligatorio** incluir en el XML y en el RIDE el número de RUC de la empresa o profesional que suministra o comercializa el software de facturación electrónica.
* **Ubicación en el XML:**
  ```xml
  <infoAdicional>
      <campoAdicional nombre="RUC Proveedor">0929433514001</campoAdicional>
  </infoAdicional>
  ```
* **Para Software de Desarrollo Propio (In-House):**
  Si el contribuyente es el desarrollador del sistema para su propio negocio (uso interno exclusivo), **no está obligado** a incluir un RUC de proveedor externo ni a registrarse como proveedor de software comercial ante el SRI bajo las actividades CIIU J62021002 / J62021003.
* **Para Comercialización a Clientes:**
  Si tú (ej. *JCTech Soluciones*) comercializas o instalas este ERP a otros negocios clientes, en las facturas emitidas por esos clientes **SÍ es legalmente obligatorio** registrar tu RUC (`0929433514001`) como `RUC Proveedor`.

#### B. Implementación en el ERP:
* En **Configuración (`/app/settings`)** se incluyó el campo:
  `RUC Proveedor de Software (Opcional)`
* **Comportamiento dinámico:**
  - Si el campo está vacío (uso propio/in-house), el sistema no envía este atributo.
  - Si tiene un RUC registrado, el backend lo inyecta automáticamente en `infoAdicional` del XML autorizado y en el RIDE.

---

### 2. Estructura Legal y Buenas Prácticas para "Información Adicional"

* **¿Es legal incluir textos como "Gracias por su compra"?**
  **Sí.** El estándar XSD del SRI (`comprobante.xsd`) define `<infoAdicional>` como un bloque flexible para hasta 15 etiquetas libres (`<campoAdicional nombre="..." valor="...">`) de hasta 300 caracteres. El webservice del SRI lo aprueba sin generar rechazo.
* **Campos formales configurados en el ERP:**
  1. `Dirección:` Se mapea si el cliente tiene dirección registrada y no es genérica.
  2. `Teléfono:` Se mapea si el cliente tiene teléfono registrado.
  3. `Email:` Se mapea el correo del cliente para entrega del comprobante electrónico.
  4. `RUC Proveedor:` Se mapea cuando aplica la Resolución 27 (software provisto a terceros).
  5. `Observaciones:` Texto configurable dinámicamente desde el campo **Mensaje Legal / Observaciones** de Configuración (sustituye el texto estático quemado en código).

---

### 3. Correcciones Visuales y Fiscales en el RIDE (PDF QuestPDF)

1. **Corrección de Subtotales Duplicados:**
   - **Problema previo:** En ventas sin IVA (como RIMPE Negocio Popular o tarifa 0%), la variable de cálculo de IVA se evaluaba a 0, haciendo que el generador dibujara dos filas consecutivas llamadas `Subtotal 0%` (`Subtotal 0% $0.00` y `Subtotal 0% $15.00`).
   - **Solución implementada:** La tabla de totales ahora distingue claramente entre `Subtotal 15%` (o la tasa IVA configurada en la empresa) y `Subtotal 0%`, garantizando que en ventas con tarifa 0% se muestre:
     - `Subtotal 15%   $0.00`
     - `Subtotal 0%   $15.00`
     - `IVA 15%        $0.00`
     - `VALOR TOTAL   $15.00`
2. **Leyenda del Régimen RIMPE:**
   - En la cabecera se mantiene la leyenda: `CONTRIBUYENTE RÉGIMEN RIMPE`.

