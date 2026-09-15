import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt, Printer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export interface TicketItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface TicketData {
  id?: number;
  fecha: string;
  vendedor: string;
  origen?: string;
  items: TicketItem[];
  total: number;
}

export function TicketImpresion({ ticket, onClose }: { ticket: TicketData; onClose: () => void }) {
  const fmtP = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
  const escaparHtml = (texto: string) =>
    texto.replace(/[&<>"']/g, (caracter) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[caracter] ?? caracter);

  const fechaStr = (() => {
    try { return format(parseISO(ticket.fecha), "dd/MM/yyyy HH:mm", { locale: es }); }
    catch { return ticket.fecha; }
  })();

  const totalUnidades = ticket.items.reduce((s, i) => s + i.cantidad, 0);

  const imprimirTicket = () => {
    const ventana = window.open("", "_blank", "width=320,height=640");
    if (!ventana) {
      window.alert("Permití las ventanas emergentes para poder imprimir el ticket.");
      return;
    }

    const productos = ticket.items.map((item) => `
      <div class="producto">
        <div class="nombre">${escaparHtml(item.nombre)}</div>
        <div class="fila">
          <span>${item.cantidad} x ${escaparHtml(fmtP(item.precioUnitario))}</span>
          <strong>${escaparHtml(fmtP(item.subtotal))}</strong>
        </div>
      </div>
    `).join("");

    ventana.document.open();
    ventana.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Ticket Doble M distribuidora</title>
          <style>
            @page { margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: monospace;
            }
            .ticket {
              width: 58mm;
              padding: 2mm;
              font-size: 10pt;
              line-height: 1.25;
            }
            .centro { text-align: center; }
            .titulo { font-size: 14pt; font-weight: 700; letter-spacing: 1px; }
            .subtitulo { font-size: 9pt; margin-top: 1mm; }
            .separador {
              border: 0;
              border-top: 1px dashed #000;
              margin: 2mm 0;
            }
            .fila {
              display: flex;
              justify-content: space-between;
              gap: 2mm;
            }
            .producto { margin-bottom: 1.5mm; }
            .nombre { font-weight: 700; overflow-wrap: anywhere; }
            .total {
              font-size: 13pt;
              font-weight: 700;
              border-top: 1px solid #000;
              padding-top: 2mm;
              margin-top: 2mm;
            }
            .pie { margin-top: 3mm; }
            .acciones {
              width: 58mm;
              padding: 3mm 2mm;
              background: #fff;
            }
            .imprimir {
              width: 100%;
              min-height: 12mm;
              border: 0;
              border-radius: 2mm;
              background: #155eef;
              color: #fff;
              font: 700 11pt sans-serif;
            }
            @media print {
              html, body, .ticket {
                width: 58mm;
              }
              .acciones { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="acciones">
            <button class="imprimir" type="button" onclick="window.print()">Imprimir ahora</button>
          </div>
          <main class="ticket">
            <header class="centro">
              <div class="titulo">DOBLE M DISTRIBUIDORA</div>
              <div class="subtitulo">${ticket.origen === "camioneta" ? "VENTA EN RUTA" : "SISTEMA DE GESTION"}</div>
            </header>
            <hr class="separador">
            ${ticket.id ? `<div class="fila"><span>Ticket</span><strong>#${String(ticket.id).padStart(4, "0")}</strong></div>` : ""}
            <div>Fecha: ${escaparHtml(fechaStr)}</div>
            <div>Vendedor: ${escaparHtml(ticket.vendedor)}</div>
            <hr class="separador">
            ${productos}
            <div class="fila total">
              <span>TOTAL</span>
              <span>${escaparHtml(fmtP(ticket.total))}</span>
            </div>
            <div class="centro pie">
              <strong>Gracias por su compra!</strong><br>
              Conserve su ticket
            </div>
            <div style="height: 8mm"></div>
          </main>
        </body>
      </html>`);
    ventana.document.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[340px] p-0 overflow-hidden gap-0">
        {/* Barra de acción (oculta al imprimir) */}
        <div className="print:hidden flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Vista previa del ticket
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
            <Button size="sm" onClick={imprimirTicket} className="gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Imprimir ticket
            </Button>
          </div>
        </div>

        {/* Ticket */}
        <div
          id="ticket-print-area"
          className="font-mono text-[12px] leading-snug p-5 bg-white text-black select-all"
        >
          {/* Encabezado */}
          <div className="text-center mb-3">
            <p className="font-bold text-[15px] tracking-widest">DOBLE M DISTRIBUIDORA</p>
            <p className="text-[10px] text-gray-500 tracking-wide">
              {ticket.origen === "camioneta" ? "Venta en Ruta" : "Sistema de Gestión"}
            </p>
          </div>

          <p className="text-center text-[10px] text-gray-400">{"─".repeat(36)}</p>

          {/* Datos */}
          <div className="my-2 space-y-0.5 text-[11px]">
            {ticket.id && (
              <div className="flex justify-between">
                <span className="text-gray-500">Ticket:</span>
                <span className="font-bold">#{String(ticket.id).padStart(4, "0")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Fecha:</span>
              <span>{fechaStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vendedor:</span>
              <span className="font-semibold">{ticket.vendedor}</span>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-400">{"─".repeat(36)}</p>

          {/* Encabezado de productos */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-[10px] text-gray-500 mt-2 mb-1 font-semibold uppercase tracking-wide">
            <span>Producto</span>
            <span className="text-right">P.Unit</span>
            <span className="text-right">Cant</span>
            <span className="text-right">Subtotal</span>
          </div>

          {/* Líneas */}
          <div className="space-y-0.5">
            {ticket.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-[11px] items-baseline">
                <span className="font-semibold truncate">{item.nombre}</span>
                <span className="text-right text-gray-500 tabular-nums">{fmtP(item.precioUnitario)}</span>
                <span className="text-right text-gray-500 tabular-nums">×{item.cantidad}</span>
                <span className="text-right font-bold tabular-nums">{fmtP(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] text-gray-400 mt-2">{"─".repeat(36)}</p>

          {/* Totales */}
          <div className="mt-2 space-y-0.5 text-[11px]">
            <div className="flex justify-between text-gray-500">
              <span>Productos</span>
              <span>{ticket.items.length} {ticket.items.length === 1 ? "ítem" : "ítems"}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Unidades</span>
              <span>{totalUnidades}</span>
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-black">
            <span className="font-bold text-[14px] tracking-wide">TOTAL</span>
            <span className="font-bold text-[16px]">{fmtP(ticket.total)}</span>
          </div>

          <p className="text-center text-[10px] text-gray-400 mt-2">{"─".repeat(36)}</p>

          <div className="text-center mt-2 space-y-0.5">
            <p className="font-semibold text-[11px]">¡Gracias por su compra!</p>
            <p className="text-[10px] text-gray-400">Conserve su ticket</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
