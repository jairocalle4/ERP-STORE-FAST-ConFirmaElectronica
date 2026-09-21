# ERP STORE FAST — Con Firma Electrónica SRI 🇪🇨

Sistema integral ERP & Punto de Venta (POS) con módulo completo de Facturación Electrónica nativa para el Servicio de Rentas Internas (SRI) del Ecuador.

---

## 📚 Documentación Técnica y Normativa SRI

Toda la documentación legal y técnica referente al SRI, sus resoluciones y correcciones está centralizada en:
* 📄 **[Guía de Facturación Electrónica SRI](file:///d:/PROYECTOS/WEB/ERP-STORE-FAST-ConFirmaElectronica/GUIA_FACTURACION_ELECTRONICA.md)**

### Principales aspectos documentados:
1. **Resolución SRI NAC-DGERCGC26-00000027 (RUC Proveedor de Software):**
   - Directriz sobre cuándo incluir el RUC del proveedor en `<infoAdicional>` (software a terceros) y cuándo omitirlo (software propio / in-house).
2. **Estructura Legal de Información Adicional:**
   - Mapeo dinámico de datos del comprador (`Dirección`, `Teléfono`, `Email`), `RUC Proveedor` y `Observaciones` configurables.
3. **Generación RIDE (PDF):**
   - Formato de totales para ventas gravadas (15%) y con tarifa 0% (RIMPE Negocio Popular).
4. **Firma Digital y Envío SOAP:**
   - Flujo de firma PKCS#12 (.p12) y autorización con el SRI.

---

## 🛠️ Arquitectura del Sistema

* **Backend API:** .NET 9 Web API (`backend-api/`) con Entity Framework Core y QuestPDF.
* **Frontend Web:** React 19 + TypeScript + Vite + TailwindCSS (`frontend-erp/`).
* **Base de Datos:** PostgreSQL (Neon Serverless).
* **Almacenamiento Multimedia:** Cloudinary.
* **Microservicio SRI:** NestJS TypeScript (`open-api-facturacion-sri/`).
