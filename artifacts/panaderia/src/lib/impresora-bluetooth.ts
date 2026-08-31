import type { TicketData } from "@/components/ticket-impresion";

const limpiarTexto = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");

const ajustarLinea = (texto: string, ancho = 32) => {
  const limpio = limpiarTexto(texto);
  if (limpio.length <= ancho) return [limpio];
  const lineas: string[] = [];
  for (let inicio = 0; inicio < limpio.length; inicio += ancho) {
    lineas.push(limpio.slice(inicio, inicio + ancho));
  }
  return lineas;
};

const padLine = (izquierda: string, derecha: string, ancho = 32) => {
  const left = limpiarTexto(izquierda).slice(0, ancho);
  const right = limpiarTexto(derecha).slice(0, ancho);
  return `${left}${" ".repeat(Math.max(1, ancho - left.length - right.length))}${right}`;
};

function formatearNumero(numero: number) {
  return `$${numero.toFixed(2)}`;
}

function ticketComoTexto(ticket: TicketData) {
  const lineas: string[] = [
    "          REGISTROAM",
    ticket.origen === "camioneta" ? "         VENTA EN RUTA" : "       SISTEMA DE GESTION",
    "-".repeat(32),
    `Ticket: #${String(ticket.id ?? "").padStart(4, "0")}`,
    `Fecha: ${new Date(ticket.fecha).toLocaleString("es-AR")}`,
    `Vendedor: ${ticket.vendedor}`,
    "-".repeat(32),
  ];

  for (const item of ticket.items) {
    lineas.push(...ajustarLinea(item.nombre));
    lineas.push(padLine(`${item.cantidad} x ${formatearNumero(item.precioUnitario)}`, formatearNumero(item.subtotal)));
  }

  lineas.push(
    "-".repeat(32),
    padLine("TOTAL", formatearNumero(ticket.total)),
    "",
    "     Gracias por su compra!",
    "",
    "",
  );
  return lineas.join("\n");
}

/**
 * RawBT registra el esquema rawbt: en Android y recibe texto URL-encoded.
 * La llamada debe ocurrir desde una acción del usuario para que Chrome permita
 * abrir la aplicación externa.
 */
export function imprimirTicketBluetooth(ticket: TicketData) {
  if (!/Android/i.test(navigator.userAgent)) {
    throw new Error("RawBT funciona desde Android. En este dispositivo usá el botón Imprimir del navegador.");
  }
  const contenido = encodeURIComponent(ticketComoTexto(ticket));
  const enlace = document.createElement("a");
  enlace.href = `rawbt:${contenido}`;
  enlace.target = "_blank";
  enlace.rel = "noopener";
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();
  window.setTimeout(() => enlace.remove(), 1000);
  return "RawBT";
}