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
  | { type: "text"; text: string }
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
  const ancho = 32;
  const separador = "-".repeat(ancho);
  const centrar = (texto: string) => {
    const limpio = limpiarTexto(texto).slice(0, ancho);
    return limpio.padStart(limpio.length + Math.floor((ancho - limpio.length) / 2));
  };
  const fila = (izquierda: string, derecha: string) => {
    const izq = limpiarTexto(izquierda);
    const der = limpiarTexto(derecha);
    const espacio = Math.max(1, ancho - izq.length - der.length);
    return `${izq}${" ".repeat(espacio)}${der}`.slice(0, ancho);
  };

  // Se usan solamente bloques de texto simples. Algunas impresoras económicas
  // alimentan papel pero ignoran los comandos ESC/POS de estilo y columnas.
  const lineas: string[] = [
    centrar("REGISTROAM"),
    centrar(ticket.origen === "camioneta" ? "VENTA EN RUTA" : "SISTEMA DE GESTION"),
    separador,
  ];

  if (ticket.id) {
    lineas.push(fila("Ticket", `#${String(ticket.id).padStart(4, "0")}`));
  }

  lineas.push(
    ...ajustarLinea(`Fecha: ${new Date(ticket.fecha).toLocaleString("es-AR")}`),
    ...ajustarLinea(`Vendedor: ${ticket.vendedor}`),
    separador,
  );

  for (const item of ticket.items) {
    lineas.push(
      ...ajustarLinea(item.nombre),
      fila(`${item.cantidad} x ${formatearNumero(item.precioUnitario)}`, formatearNumero(item.subtotal)),
    );
  }

  lineas.push(
    separador,
    fila("TOTAL", formatearNumero(ticket.total)),
    separador,
    centrar("Gracias por su compra!"),
    centrar("Conserve su ticket"),
  );

  return [
    ...lineas.map((text) => ({ type: "text" as const, text })),
    { type: "feed", lines: 3 },
  ];
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