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

function formatearNumero(numero: number) {
  return `$${numero.toFixed(2)}`;
}

const CLEANTER_URL = "http://localhost:9100";

type CleanterBlock =
  | { type: "text"; text: string; align?: "left" | "center" | "right"; bold?: boolean; size?: "normal" | "large" }
  | { type: "row"; left: string; right: string; bold?: boolean }
  | { type: "divider" }
  | { type: "feed"; lines: number };

type CleanterHealth = {
  status?: string;
  printer?: {
    connected?: boolean;
    name?: string;
    problem?: string | null;
  };
};

function ticketParaCleanter(ticket: TicketData): CleanterBlock[] {
  const bloques: CleanterBlock[] = [
    { type: "text", text: "REGISTROAM", align: "center", bold: true, size: "large" },
    {
      type: "text",
      text: ticket.origen === "camioneta" ? "VENTA EN RUTA" : "SISTEMA DE GESTION",
      align: "center",
    },
    { type: "divider" },
  ];

  if (ticket.id) {
    bloques.push({ type: "row", left: "Ticket", right: `#${String(ticket.id).padStart(4, "0")}` });
  }

  bloques.push(
    { type: "row", left: "Fecha", right: new Date(ticket.fecha).toLocaleString("es-AR") },
    { type: "row", left: "Vendedor", right: limpiarTexto(ticket.vendedor) },
    { type: "divider" },
  );

  for (const item of ticket.items) {
    for (const linea of ajustarLinea(item.nombre)) {
      bloques.push({ type: "text", text: linea, bold: true });
    }
    bloques.push({
      type: "row",
      left: `${item.cantidad} x ${formatearNumero(item.precioUnitario)}`,
      right: formatearNumero(item.subtotal),
    });
  }

  bloques.push(
    { type: "divider" },
    { type: "row", left: "TOTAL", right: formatearNumero(ticket.total), bold: true },
    { type: "text", text: "Gracias por su compra!", align: "center", bold: true },
    { type: "text", text: "Conserve su ticket", align: "center" },
    { type: "feed", lines: 3 },
  );

  return bloques;
}

function mensajeProblemaCleanter(problem?: string | null) {
  switch (problem) {
    case "bluetooth_disabled":
      return "Activá el Bluetooth del teléfono.";
    case "printer_unreachable":
      return "La impresora no responde. Verificá que esté encendida y cerca.";
    case "printer_not_selected":
      return "Seleccioná la MTP-2 como impresora predeterminada dentro de Cleanter.";
    default:
      return "Abrí Cleanter y verificá que la MTP-2 figure conectada.";
  }
}

export async function imprimirTicketBluetooth(ticket: TicketData) {
  if (!/Android/i.test(navigator.userAgent)) {
    throw new Error("Cleanter funciona desde Android. En este dispositivo usá el botón Imprimir del navegador.");
  }

  let health: CleanterHealth;
  try {
    const respuesta = await fetch(`${CLEANTER_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!respuesta.ok) throw new Error();
    health = await respuesta.json();
  } catch {
    throw new Error("No se encontró Cleanter. Abrí la aplicación Cleanter y volvé a intentar.");
  }

  if (!health.printer?.connected) {
    throw new Error(mensajeProblemaCleanter(health.printer?.problem));
  }

  const respuesta = await fetch(`${CLEANTER_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paperWidth: 58,
      cut: false,
      reference: ticket.id ? `RegistroAM #${ticket.id}` : "RegistroAM",
      content: ticketParaCleanter(ticket),
    }),
  });

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(
      error.detail || error.fix || mensajeProblemaCleanter(error.error),
    );
  }

  return health.printer.name ? `Cleanter (${health.printer.name})` : "Cleanter";
}