import { useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import type { TicketData } from "@/components/ticket-impresion";

function formatearPrecio(valor: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(valor);
}

export default function ImprimirTicket() {
  const [enviando, setEnviando] = useState(false);
  const ticket = useMemo<TicketData | null>(() => {
    try {
      const guardado = sessionStorage.getItem("ticket-para-imprimir");
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      return null;
    }
  }, []);

  if (!ticket) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <p>No se encontró un ticket para imprimir.</p>
        <button className="mt-4 underline" onClick={() => window.history.back()}>
          Volver
        </button>
      </main>
    );
  }

  const fecha = new Date(ticket.fecha).toLocaleString("es-AR");

  const imprimir = async () => {
    if (!/Android/i.test(navigator.userAgent)) {
      window.print();
      return;
    }

    const contenido = document.querySelector(".ticket-termico")?.outerHTML;
    if (!contenido) return;

    setEnviando(true);
    try {
      const pagina = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { margin: 0; }
              * { box-sizing: border-box; }
              html, body {
                width: 100%;
                margin: 0;
                padding: 0;
                color: #000;
                background: #fff;
              }
              .ticket-termico {
                width: 100%;
                max-width: none;
                margin: 0 auto;
                padding: 1.5mm;
                font: 12pt/1.25 monospace;
                color: #000;
              }
              header, .text-center { text-align: center; }
              h1 { margin: 0; font-size: 16pt; line-height: 1.1; }
              p { margin: 0; }
              hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .gap-2 { gap: 2mm; }
              .font-bold, strong { font-weight: 700; }
              .mb-2 { margin-bottom: 2mm; }
              .mt-2 { margin-top: 2mm; }
              .mt-3 { margin-top: 3mm; }
              .pt-2 { padding-top: 2mm; }
              .border-t { border-top: 1px solid #000; }
              .break-words { overflow-wrap: anywhere; }
              .h-\\[8mm\\] { height: 8mm; }
              .text-\\[13pt\\] { font-size: 15pt; }
            </style>
          </head>
          <body>${contenido}</body>
        </html>`;

      const comprimido = new Blob([JSON.stringify([pagina])])
        .stream()
        .pipeThrough(new CompressionStream("gzip"));
      const bytes = new Uint8Array(await new Response(comprimido).arrayBuffer());
      let binario = "";
      const tamanoBloque = 8192;
      for (let inicio = 0; inicio < bytes.length; inicio += tamanoBloque) {
        binario += String.fromCharCode(...bytes.subarray(inicio, inicio + tamanoBloque));
      }
      const contenidoBase64 = btoa(binario);
      window.location.href =
        `intent://#Intent;scheme=print-intent;S.content=${encodeURIComponent(contenidoBase64)};end`;
    } catch {
      window.alert("No se pudo abrir Open ESC/POS. Verificá que esté instalado y actualizado.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <style>{`
        @page { margin: 0; }
        @media print {
          html, body {
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .acciones-ticket { display: none !important; }
          .ticket-termico {
            width: 58mm !important;
            padding: 2mm !important;
          }
        }
      `}</style>

      <div className="acciones-ticket sticky top-0 z-10 flex gap-2 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 font-sans text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <button
          type="button"
          onClick={imprimir}
          disabled={enviando}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 font-sans text-sm font-bold text-white"
        >
          <Printer className="h-4 w-4" />
          {enviando ? "Abriendo impresora..." : "Imprimir ahora"}
        </button>
      </div>

      <section className="ticket-termico w-[58mm] bg-white p-[2mm] font-mono text-[10pt] leading-tight text-black">
        <header className="text-center">
          <h1 className="text-[14pt] font-bold tracking-wide">DOBLE M DISTRIBUIDORA</h1>
          <p className="mt-1 text-[9pt]">
            {ticket.origen === "camioneta" ? "VENTA EN RUTA" : "SISTEMA DE GESTION"}
          </p>
        </header>

        <hr className="my-2 border-0 border-t border-dashed border-black" />
        {ticket.id && (
          <div className="flex justify-between">
            <span>Ticket</span>
            <strong>#{String(ticket.id).padStart(4, "0")}</strong>
          </div>
        )}
        <p>Fecha: {fecha}</p>
        <p>Vendedor: {ticket.vendedor}</p>
        <hr className="my-2 border-0 border-t border-dashed border-black" />

        {ticket.items.map((item, indice) => (
          <div key={indice} className="mb-2">
            <p className="break-words font-bold">{item.nombre}</p>
            <div className="flex justify-between gap-2">
              <span>{item.cantidad} x {formatearPrecio(item.precioUnitario)}</span>
              <strong>{formatearPrecio(item.subtotal)}</strong>
            </div>
          </div>
        ))}

        <div className="mt-2 flex justify-between border-t border-black pt-2 text-[13pt] font-bold">
          <span>TOTAL</span>
          <span>{formatearPrecio(ticket.total)}</span>
        </div>
        <div className="mt-3 text-center">
          <strong>Gracias por su compra!</strong>
          <br />
          <span>Conserve su ticket</span>
        </div>
        <div className="h-[8mm]" />
      </section>
    </main>
  );
}