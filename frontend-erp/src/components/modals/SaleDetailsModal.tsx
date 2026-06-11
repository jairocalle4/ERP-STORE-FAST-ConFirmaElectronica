import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Calendar, User, Package, Hash, CreditCard, Download, Trash2, FileText, Zap } from 'lucide-react';
import type { Sale } from '../../services/sale.service';
import { saleService } from '../../services/sale.service';
import { companyService, type CompanySetting } from '../../services/company.service';
import { useNotificationStore } from '../../store/useNotificationStore';
import { electronicBillingService } from '../../services/electronic-billing.service';

interface SaleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale | null;
    autoPrint?: boolean;
    onVoid?: () => void;
}

const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ isOpen, onClose, sale, autoPrint = false, onVoid }) => {
    const addNotification = useNotificationStore(state => state.addNotification);
    const [isVoiding, setIsVoiding] = React.useState(false);
    const [showConfirmVoid, setShowConfirmVoid] = React.useState(false);
    const [company, setCompany] = React.useState<CompanySetting | null>(null);
    const [isReemitting, setIsReemitting] = React.useState(false);

    const handleReemit = async () => {
        if (!sale) return;
        setIsReemitting(true);
        try {
            const result = await electronicBillingService.emitirFactura(sale.id);
            if (result.success) {
                addNotification('¡Factura emitida y autorizada con éxito!', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                addNotification(`Fallo al emitir la factura: ${result.errorMessage}`, 'error');
            }
        } catch (error: any) {
            console.error(error);
            const serverError = error?.response?.data?.error || error?.response?.data || error?.message || 'Error al emitir';
            addNotification(`Error al emitir factura: ${serverError}`, 'error');
        } finally {
            setIsReemitting(false);
        }
    };

    // Load company settings for print
    React.useEffect(() => {
        if (isOpen) {
            const loadSettings = async () => {
                try {
                    const data = await companyService.getSettings();
                    setCompany(data);
                } catch (err) {
                    console.error('Error fetching company settings for print', err);
                }
            };
            loadSettings();
        }
    }, [isOpen]);

    // Auto-print effect
    React.useEffect(() => {
        if (isOpen && sale && autoPrint) {
            // Small delay to ensure modal is rendered
            const timer = setTimeout(() => {
                handlePrint();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen, sale, autoPrint]);

    if (!isOpen || !sale) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // ── Método profesional: Blob URL + iframe oculto ──────────────────────────
    // No requiere popup ni permisos especiales del navegador.
    // Misma técnica que usa la librería print-js internamente.
    const openPrintWindow = (htmlContent: string) => {
        const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;';
        document.body.appendChild(iframe);

        iframe.onload = () => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } catch (e) {
                console.error('Error al imprimir:', e);
            }
            // Limpieza después de que el diálogo de impresión se cierra
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
            }, 1500);
        };

        // Asignar src DESPUÉS del onload dispara la carga confiablemente
        iframe.src = blobUrl;
    };

    const handlePrint = () => {
        if (!sale) return;

        const saleAny = sale as any;
        const isElectronic = !!saleAny.isElectronic;
        const isAuthorized = saleAny.electronicStatus === 'AUTORIZADO';
        const authNumber = saleAny.authorizationNumber || '';
        const authDate = saleAny.authorizationDate
            ? new Date(saleAny.authorizationDate).toLocaleString('es-EC')
            : '';
        const accessKey = saleAny.accessKey || '';

        const accessKeyFormatted = accessKey
            ? accessKey.match(/.{1,10}/g)?.join(' ') ?? accessKey
            : '';

        // Build ticket HTML
        const ticketHTML = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>${isElectronic && isAuthorized ? 'FACTURA ELECTRÓNICA' : 'Ticket de Venta'} # ${sale.noteNumber || sale.id}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        * { box-sizing: border-box; }
                        body {
                            font-family: 'Courier New', Courier, monospace;
                            width: 80mm;
                            padding: 4mm;
                            margin: 0 auto;
                            font-size: 11px;
                            line-height: 1.4;
                            color: #000;
                        }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .bold { font-weight: bold; }
                        .divider { border-top: 1px dashed #000; margin: 3mm 0; }
                        .divider-solid { border-top: 1px solid #000; margin: 3mm 0; }
                        .store-name { font-size: 14px; font-weight: bold; margin-bottom: 1mm; }
                        .doc-type { font-size: 11px; font-weight: bold; border: 1px solid #000; padding: 1mm 3mm; margin: 2mm auto; display: inline-block; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 1mm; font-size: 10px; }
                        table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
                        th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 1mm; font-size: 9px; text-transform: uppercase; }
                        td { padding: 1mm 0; vertical-align: top; font-size: 10px; }
                        .total-section { margin-top: 2mm; }
                        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; }
                        .sub-row { display: flex; justify-content: space-between; font-size: 9px; color: #555; margin-bottom: 0.5mm; }
                        .footer { margin-top: 5mm; font-size: 9px; text-align: center; }
                        .sri-section { margin-top: 3mm; padding: 2mm; border: 1px solid #000; font-size: 9px; }
                        .sri-title { font-weight: bold; font-size: 10px; text-align: center; margin-bottom: 2mm; }
                        .access-key { font-size: 7px; letter-spacing: 0.3px; word-break: break-all; text-align: center; margin: 1mm 0; }
                        .rimpe-legend { font-size: 8px; text-align: center; font-style: italic; border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                        .auth-ok { font-weight: bold; text-align: center; font-size: 10px; }
                        .auth-pending { font-size: 9px; text-align: center; color: #555; font-style: italic; }
                    </style>
                </head>
                <body>
                    <div class="text-center">
                        <div class="store-name">${company?.name || 'ERP STORE FAST'}</div>
                        ${isElectronic ? `<div><span class="doc-type">FACTURA</span></div>` : ''}
                        <div>RUC: ${company?.ruc || '0000000000001'}</div>
                        ${company?.address ? `<div>Dir: ${company.address}</div>` : ''}
                        ${company?.phone ? `<div>Telf: ${company.phone}</div>` : ''}
                        ${isElectronic ? `<div>Est: ${company?.establishment || '001'} &nbsp; P.E: ${company?.pointOfIssue || '001'}</div>` : ''}
                    </div>

                    <div class="divider"></div>

                    <div class="info-row"><span>${isElectronic ? 'Nº FACTURA:' : '# NOTA:'}</span><span class="bold">${sale.noteNumber || `V-${sale.id}`}</span></div>
                    <div class="info-row"><span>FECHA:</span><span>${new Date(sale.date).toLocaleString('es-EC')}</span></div>
                    <div class="info-row"><span>CLIENTE:</span><span class="bold">${sale.client?.name || 'CONSUMIDOR FINAL'}</span></div>
                    <div class="info-row"><span>C.I./RUC:</span><span>${sale.client?.cedulaRuc || '9999999999'}</span></div>
                    <div class="info-row"><span>VENDEDOR:</span><span>${sale.employee?.name || 'Sistema'}</span></div>
                    <div class="info-row"><span>PAGO:</span><span class="bold">${sale.paymentMethod?.toUpperCase() || 'EFECTIVO'}</span></div>

                    <div class="divider"></div>

                    <table>
                        <thead><tr><th>CANT. PRODUCTO</th><th class="text-right">TOTAL</th></tr></thead>
                        <tbody>
                            ${(sale.saleDetails || []).map(detail => `
                                <tr>
                                    <td>${detail.quantity} x ${detail.productName || detail.product?.name || 'Producto'}</td>
                                    <td class="text-right">$${(detail.unitPrice * detail.quantity).toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td colspan="2" style="font-size:8px;color:#666;padding-top:0;">P.U: $${detail.unitPrice.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="divider"></div>

                    <div class="total-section">
                        <div class="sub-row"><span>SUBTOTAL IVA 0%:</span><span>$${sale.total.toFixed(2)}</span></div>
                        <div class="sub-row"><span>SUBTOTAL IVA ${isElectronic ? '15' : '0'}%:</span><span>$0.00</span></div>
                        <div class="sub-row"><span>IVA (15%):</span><span>$0.00</span></div>
                        <div class="divider-solid"></div>
                        <div class="total-row"><span>TOTAL A PAGAR:</span><span>$${sale.total.toFixed(2)}</span></div>
                    </div>

                    ${isElectronic ? `
                    <div class="sri-section">
                        <div class="sri-title">★ COMPROBANTE ELECTRÓNICO SRI ★</div>
                        ${isAuthorized ? `
                            <div class="auth-ok">✓ AUTORIZADO</div>
                            <div class="info-row" style="margin-top:1mm;"><span>Nº AUTORIZACIÓN:</span></div>
                            <div style="font-size:8px;word-break:break-all;text-align:center;margin:0.5mm 0;">${authNumber}</div>
                            <div class="info-row"><span>FECHA AUTORIZACIÓN:</span><span>${authDate}</span></div>
                        ` : `<div class="auth-pending">○ PENDIENTE DE AUTORIZACIÓN</div>`}
                        <div class="info-row" style="margin-top:1mm;"><span>CLAVE DE ACCESO:</span></div>
                        <div class="access-key">${accessKeyFormatted}</div>
                        <div class="rimpe-legend">CONTRIBUYENTE RÉGIMEN RIMPE<br/>NEGOCIO POPULAR - NO COBRA IVA</div>
                    </div>` : ''}
                    <div class="footer">
                        <div class="bold">¡GRACIAS POR SU COMPRA!</div>
                        <div>${company?.legalMessage || 'Conserve su ticket para cambios o devoluciones.'}</div>
                    </div>
                </body>
            </html>`;

        openPrintWindow(ticketHTML);
    };

    const handlePrintInvoice = () => {
        if (!sale) return;
        const saleAny = sale as any;
        const isElectronic = !!saleAny.isElectronic;
        const isAuthorized = saleAny.electronicStatus === 'AUTORIZADO';
        const accessKey: string = saleAny.accessKey || '';
        const authNumber: string = saleAny.authorizationNumber || '';
        const authDate: string = saleAny.authorizationDate
            ? new Date(saleAny.authorizationDate).toLocaleString('es-EC')
            : '';
        const subtotal = sale.total;
        const accessKeyFormatted = accessKey ? (accessKey.match(/.{1,10}/g) || []).join('  ') : '(Pendiente de autorización SRI)';
        const detailRows = (sale.saleDetails || []).map((d, i) => {
            const tot = d.unitPrice * d.quantity;
            return `<tr><td style="text-align:center">${String(i+1).padStart(3,'0')}</td><td>${d.productName || d.product?.name || 'Producto/Servicio'}</td><td style="text-align:right">${d.quantity}</td><td style="text-align:right">$${d.unitPrice.toFixed(2)}</td><td style="text-align:right">$0.00</td><td style="text-align:right">$${tot.toFixed(2)}</td></tr>`;
        }).join('');
        const invoiceHTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>RIDE - ${sale.noteNumber || sale.id}</title><style>
@page{size:A4 portrait;margin:12mm 10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9.5px;color:#0f172a;line-height:1.35}
.hg{display:grid;grid-template-columns:1fr 210px;gap:6px;margin-bottom:5px}
.cb{border:1px solid #64748b;padding:7px 9px}
.cn{font-size:14px;font-weight:900;text-transform:uppercase;margin-bottom:3px}
.cd{font-size:8px;color:#475569;margin-top:1px}
.cd b{color:#0f172a}
.db{border:1px solid #64748b;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:5px 7px;gap:2px}
.dtype{font-size:12px;font-weight:900;text-transform:uppercase;border:2px solid #0f172a;padding:2px 8px;letter-spacing:1px}
.dnum{font-size:12px;font-weight:700}
.dm{font-size:8px;color:#475569}
.dm b{color:#0f172a}
.ak{border:1px solid #64748b;padding:4px 7px;margin-bottom:5px}
.alk{font-size:7.5px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:2px}
.akv{font-family:'Courier New',monospace;font-size:8.5px;font-weight:700;word-break:break-all}
.ar{display:flex;justify-content:space-between;margin-top:3px;font-size:8px}
.ok{display:inline-block;background:#dcfce7;color:#166534;font-weight:700;font-size:7px;padding:1px 5px;border-radius:2px;border:1px solid #86efac}
.pend{display:inline-block;background:#fef9c3;color:#854d0e;font-weight:700;font-size:7px;padding:1px 5px;border-radius:2px}
.rimpe{border:1.5px solid #0f172a;padding:3px 8px;text-align:center;font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px}
.sb{border:1px solid #64748b;padding:4px 7px;margin-bottom:5px}
.st{font-size:7.5px;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:2px;margin-bottom:3px;letter-spacing:0.3px}
.bg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px}
.fl{font-size:7.5px;color:#64748b;text-transform:uppercase;font-weight:700}
.fv{font-size:9.5px;font-weight:600;margin-top:1px}
table{width:100%;border-collapse:collapse;margin-bottom:5px;font-size:8.5px}
.th{background:#1e293b;color:white}
.th th{padding:4px 5px;text-align:left;font-size:8px;text-transform:uppercase;font-weight:700}
tr:nth-child(even){background:#f8fafc}
td{padding:3px 5px;border-bottom:1px solid #e2e8f0;vertical-align:top}
.botg{display:grid;grid-template-columns:1fr 190px;gap:5px;margin-bottom:5px}
.pb{border:1px solid #64748b;padding:4px 7px}
.tb{border:1px solid #64748b}
.tr{display:flex;justify-content:space-between;padding:3px 7px;border-bottom:1px solid #f1f5f9;font-size:8.5px}
.tr.grand{background:#1e293b;color:white;font-weight:900;font-size:10px;padding:4px 7px}
.trl{color:#475569}
.tr.grand .trl{color:#94a3b8}
.pban{border:2px dashed #f59e0b;background:#fffbeb;padding:5px 8px;text-align:center;font-size:8px;color:#92400e;margin-bottom:5px}
.lf{border-top:1px solid #e2e8f0;padding-top:4px;font-size:7.5px;color:#94a3b8;text-align:center}
</style></head><body>
<div class="hg">
  <div class="cb">
    <div class="cn">${company?.name || 'ERP STORE FAST'}</div>
    <div class="cd"><b>Dirección Matriz:</b> ${company?.address || 'Sin dirección'}</div>
    <div class="cd"><b>Teléfono:</b> ${company?.phone || '—'} &nbsp; <b>Email:</b> ${company?.email || '—'}</div>
    <div class="cd"><b>Obligado a llevar contabilidad:</b> NO</div>
    <div class="cd" style="margin-top:3px;font-size:8px;font-weight:700;text-transform:uppercase">Contribuyente RIMPE – Negocio Popular</div>
  </div>
  <div class="db">
    <div class="dtype">FACTURA</div>
    <div class="dm"><b>RUC:</b> ${company?.ruc || '0000000000001'}</div>
    <div class="dnum">${sale.noteNumber || `001-001-${String(sale.id).padStart(9,'0')}`}</div>
    <div class="dm"><b>Nº Autorización:</b></div>
    <div style="font-family:monospace;font-size:7px;word-break:break-all;color:#0f172a">${authNumber || '(Pendiente SRI)'}</div>
    <div class="dm"><b>F. Autorización:</b> ${authDate || '(Pendiente)'}</div>
    <div class="dm"><b>Ambiente:</b> ${isElectronic ? (isAuthorized ? 'PRODUCCIÓN' : 'PRUEBAS') : 'NO CONECTADO'} &nbsp; <b>Emisión:</b> NORMAL</div>
    <div class="dm"><b>F. Emisión:</b> ${new Date(sale.date).toLocaleDateString('es-EC')}</div>
  </div>
</div>
<div class="ak">
  <div class="alk">Clave de Acceso (49 dígitos)</div>
  <div class="akv">${accessKeyFormatted}</div>
  ${isElectronic ? `<div class="ar"><span><b>Estado SRI:</b> <span class="${isAuthorized ? 'ok' : 'pend'}">${isAuthorized ? '✓ AUTORIZADO' : '⏳ PENDIENTE'}</span></span><span><b>Nº Autorización:</b> ${authNumber || '—'}</span><span><b>F. Autorización:</b> ${authDate || '—'}</span></div>` : ''}
</div>
<div class="rimpe">★ CONTRIBUYENTE RÉGIMEN RIMPE — NEGOCIO POPULAR — NO COBRA IVA ★</div>
<div class="sb">
  <div class="st">Datos del Comprador / Receptor</div>
  <div class="bg">
    <div><div class="fl">Razón Social / Nombres:</div><div class="fv">${sale.client?.name || 'CONSUMIDOR FINAL'}</div></div>
    <div><div class="fl">Identificación (C.I./RUC/Pasaporte):</div><div class="fv">${sale.client?.cedulaRuc || '9999999999'}</div></div>
    <div><div class="fl">Método de Pago:</div><div class="fv">${sale.paymentMethod || 'Efectivo'}</div></div>
  </div>
</div>
<table>
  <thead class="th"><tr><th style="width:8%;text-align:center">Cód.</th><th>Descripción del Bien / Servicio</th><th style="width:7%;text-align:right">Cant.</th><th style="width:11%;text-align:right">P.Unitario</th><th style="width:10%;text-align:right">Descuento</th><th style="width:12%;text-align:right">P.Total</th></tr></thead>
  <tbody>${detailRows}</tbody>
</table>
<div class="botg">
  <div class="pb">
    <div class="st">Forma de Pago</div>
    <table style="margin-bottom:0"><thead class="th"><tr><th>Forma de Pago</th><th style="text-align:right">Plazo</th><th style="text-align:right">Unidad</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody><tr><td>${sale.paymentMethod || 'Efectivo'}</td><td style="text-align:right">—</td><td style="text-align:right">—</td><td style="text-align:right">$${subtotal.toFixed(2)}</td></tr></tbody></table>
  </div>
  <div class="tb">
    <div class="tr"><span class="trl">Subtotal sin Impuestos</span><span>$${subtotal.toFixed(2)}</span></div>
    <div class="tr"><span class="trl">Subtotal IVA 0%</span><span>$${subtotal.toFixed(2)}</span></div>
    <div class="tr"><span class="trl">Subtotal No Objeto IVA</span><span>$0.00</span></div>
    <div class="tr"><span class="trl">Subtotal Exento IVA</span><span>$0.00</span></div>
    <div class="tr"><span class="trl">Descuento Total</span><span>$0.00</span></div>
    <div class="tr"><span class="trl">IVA 0% (RIMPE)</span><span>$0.00</span></div>
    <div class="tr grand"><span class="trl">VALOR TOTAL</span><span>$${subtotal.toFixed(2)}</span></div>
  </div>
</div>
${!isElectronic ? `<div class="pban">⚠ <b>DOCUMENTO INTERNO — NO VÁLIDO COMO COMPROBANTE TRIBUTARIO</b><br/>Vista previa del RIDE. Válido como referencia interna hasta obtener la Firma Electrónica y autorización del SRI.</div>` : ''}
<div class="lf">
  <div>${isElectronic && isAuthorized ? '✓ DOCUMENTO AUTORIZADO POR EL SERVICIO DE RENTAS INTERNAS — www.sri.gob.ec' : 'Representación Impresa del Documento Electrónico (RIDE) — Autorización pendiente SRI'}</div>
  <div>Contribuyente RIMPE – Negocio Popular | No está obligado a cobrar IVA | Régimen Simplificado</div>
  <div style="font-size:7px;color:#cbd5e1">Generado: ${new Date().toLocaleString('es-EC')} — ERP-STORE-FAST</div>
</div>
</body></html>`;
        openPrintWindow(invoiceHTML);
    };

    const handleVoid = async () => {
        if (!sale) return;
        setIsVoiding(true);
        try {
            console.log('Anulando venta ID:', sale.id);
            await saleService.void(sale.id);
            addNotification('Venta anulada correctamente. Stock restaurado.', 'success');
            if (onVoid) onVoid();
            onClose();
        } catch (err) {
            console.error('Error voiding sale:', err);
            addNotification('Error al intentar anular la venta', 'error');
        } finally {
            setIsVoiding(false);
            setShowConfirmVoid(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            {/* Wrapper to ensure centering */}
            <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
                <div
                    className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-[0_40px_100px_rgba(0,0,0,0.2)] animate-scale-in border border-slate-100 overflow-hidden flex flex-col max-h-[calc(100vh-4rem)] text-left"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                                <Hash size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Detalle de Venta</h2>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Transacción #{sale.noteNumber || sale.id}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shadow-sm"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto grow p-8 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-8 mb-10">
                            {/* Information Cards */}
                            <div className="space-y-4">
                                <div className="flex items-start gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                                    <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Cliente</p>
                                        <p className="font-bold text-slate-800">{sale.client?.name || 'Consumidor Final'}</p>
                                        <p className="text-xs text-slate-500 font-medium">{sale.client?.cedulaRuc || '9999999999'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                                    <div className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm">
                                        <Calendar size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Fecha y Hora</p>
                                        <p className="font-bold text-slate-800">{formatDate(sale.date)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                                    <div className="p-3 bg-white rounded-2xl text-amber-600 shadow-sm">
                                        <CreditCard size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Vendedor encargado</p>
                                        <p className="font-bold text-slate-800">{sale.employee?.name || 'Administrador'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                                    <div className="p-3 bg-white rounded-2xl text-slate-600 shadow-sm">
                                        <Hash size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Estado / Pago</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {sale.isVoid ? (
                                                <span className="px-3 py-1 bg-rose-100 text-rose-600 text-[10px] font-black uppercase rounded-lg">Anulada</span>
                                            ) : (
                                                <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-[10px] font-black uppercase rounded-lg">Completada</span>
                                            )}
                                            <span className="px-3 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase rounded-lg">{sale.paymentMethod || 'Efectivo'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Products Table */}
                        <div className="bg-white border-2 border-slate-50 rounded-[2rem] overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cant.</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">P. Unit.</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-slate-50">
                                    {sale.saleDetails?.map((detail) => (
                                        <tr key={detail.id} className="group hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                        <Package size={20} />
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-sm leading-tight">{detail.productName || detail.product?.name || 'Producto'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg">{detail.quantity}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-500 text-sm">
                                                ${detail.unitPrice.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-800">
                                                ${(detail.quantity * detail.unitPrice).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Total Summary */}
                        <div className="mt-8 flex justify-end">
                            <div className="w-64 space-y-3 bg-slate-900 p-6 rounded-[2rem] text-white shadow-2xl shadow-slate-900/20">
                                <div className="flex justify-between items-center opacity-60">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Subtotal IVA 0%</span>
                                    <span className="font-bold text-sm">${sale.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center opacity-40">
                                    <span className="text-[10px] font-black uppercase tracking-widest">IVA (0%)</span>
                                    <span className="font-bold text-sm">$0.00</span>
                                </div>
                                <div className="pt-3 border-t border-white/10 flex justify-between items-end">
                                    <span className="text-xs font-black uppercase tracking-widest">Total Final</span>
                                    <span className="text-2xl font-black text-indigo-400 tracking-tighter">${sale.total.toFixed(2)}</span>
                                </div>
                                {(sale as any).isElectronic && (
                                    <div className="pt-2 border-t border-white/10">
                                        <p className="text-[9px] text-center font-black uppercase tracking-widest text-emerald-400">
                                            {(sale as any).electronicStatus === 'AUTORIZADO' ? '✓ Factura Electrónica Autorizada' : '⏳ FE: ' + ((sale as any).electronicStatus ?? 'Pendiente')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
                        {!sale.isVoid && (
                            <div className="flex gap-2">
                                {!showConfirmVoid ? (
                                    <button
                                        onClick={() => setShowConfirmVoid(true)}
                                        className="px-6 py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3 border border-rose-100"
                                    >
                                        <Trash2 size={18} />
                                        Anular Venta
                                    </button>
                                ) : (
                                    <div className="flex gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                                        <button
                                            onClick={handleVoid}
                                            disabled={isVoiding}
                                            className="px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3 shadow-lg shadow-rose-200"
                                        >
                                            {isVoiding ? (
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                            ¿CONFIRMAS?
                                        </button>
                                        <button
                                            onClick={() => setShowConfirmVoid(false)}
                                            disabled={isVoiding}
                                            className="px-4 py-4 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all"
                                        >
                                            No
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex-1 flex gap-4">
                            <button
                                onClick={handlePrint}
                                className="flex-1 py-4 bg-white border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-slate-600 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10"
                            >
                                <Printer size={18} />
                                Ticket 80mm
                            </button>
                            <button
                                onClick={handlePrintInvoice}
                                className="flex-1 py-4 bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-indigo-700 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 shadow-sm"
                            >
                                <FileText size={18} />
                                Factura A4
                            </button>
                            {/* FE: XML & RIDE download buttons if authorized, or Reintentar button if failed/pending */}
                            {(sale as any).isElectronic && (
                                (sale as any).electronicStatus === 'AUTORIZADO' ? (
                                    <>
                                        <button
                                            onClick={() => electronicBillingService.descargarXml(sale.id, sale.noteNumber || String(sale.id))}
                                            className="px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-lg shadow-blue-200"
                                            title="Descargar XML Autorizado"
                                        >
                                            <Download size={16} />
                                            XML
                                        </button>
                                        <button
                                            onClick={() => electronicBillingService.descargarRide(sale.id, sale.noteNumber || String(sale.id))}
                                            className="px-4 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-lg shadow-purple-200"
                                            title="Descargar RIDE (PDF SRI)"
                                        >
                                            <FileText size={16} />
                                            RIDE
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleReemit}
                                        disabled={isReemitting}
                                        className="px-4 py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-lg shadow-amber-200"
                                        title="Reintentar emisión de factura electrónica"
                                    >
                                        {isReemitting ? (
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <Zap size={16} />
                                        )}
                                        Reintentar FE
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SaleDetailsModal;
