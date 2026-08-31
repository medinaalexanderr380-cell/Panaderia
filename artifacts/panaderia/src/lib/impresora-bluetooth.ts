import type { TicketData } from "@/components/ticket-impresion";

type BluetoothCharacteristic = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
};

type BluetoothService = {
  getCharacteristics: () => Promise<BluetoothCharacteristic[]>;
};

type BluetoothDevice = {
  name?: string;
  gatt?: {
    connect: () => Promise<{ getPrimaryServices: () => Promise<BluetoothService[]> }>;
  };
};

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice: (options: {
      acceptAllDevices: boolean;
      optionalServices: string[];
    }) => Promise<BluetoothDevice>;
  };
};

const POS_SERVICE_IDS = [
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000e781-0000-1000-8000-00805f9b34fb",
];

const limpiarTexto = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");

const ajustarLinea = (texto: string, ancho = 32) => {
  const limpio = limpiarTexto(texto);
  if (limpio.length <= ancho) return [limpio];
  const lineas: string[] = [];
  for (let inicio = 0; inicio < limpio.length; inicio += ancho) lineas.push(limpio.slice(inicio, inicio + ancho));
  return lineas;
};

const padLine = (izquierda: string, derecha: string, ancho = 32) => {
  const left = limpiarTexto(izquierda).slice(0, ancho);
  const right = limpiarTexto(derecha).slice(0, ancho);
  const espacios = Math.max(1, ancho - left.length - right.length);
  return `${left}${" ".repeat(espacios)}${right}`;
};

function ticketComoEscPos(ticket: TicketData) {
  const lineas: string[] = [
    "\x1b\x40",
    "\x1b\x61\x01",
    "\x1b\x45\x01",
    "REGISTROAM",
    "\x1b\x45\x00",
    ticket.origen === "camioneta" ? "VENTA EN RUTA" : "SISTEMA DE GESTION",
    "-".repeat(32),
    "\x1b\x61\x00",
    `Ticket: #${String(ticket.id ?? "").padStart(4, "0")}`,
    `Fecha: ${new Date(ticket.fecha).toLocaleString("es-AR")}`,
    `Vendedor: ${ticket.vendedor}`,
    "-".repeat(32),
  ];

  for (const item of ticket.items) {
    for (const nombre of ajustarLinea(item.nombre)) {
      lineas.push(nombre);
    }
    lineas.push(padLine(`${item.cantidad} x ${formatearNumero(item.precioUnitario)}`, formatearNumero(item.subtotal)));
  }
  lineas.push(
    "-".repeat(32),
    padLine("TOTAL", formatearNumero(ticket.total)),
    "",
    "\x1b\x61\x01",
    "Gracias por su compra!",
    "\x1b\x64\x03",
    "\x1d\x56\x00",
  );
  return new TextEncoder().encode(`${lineas.join("\n")}\n`);
}

function formatearNumero(numero: number) {
  return `$${numero.toFixed(2)}`;
}

async function encontrarCaracteristica(device: BluetoothDevice) {
  if (!device.gatt) throw new Error("El dispositivo no permite conexión Bluetooth desde el navegador.");
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find(item => item.properties.writeWithoutResponse || item.properties.write);
    if (writable) return writable;
  }
  throw new Error("La impresora se conectó, pero no ofrece un canal BLE de escritura. Esta MTP-2 probablemente usa Bluetooth clásico.");
}

export async function imprimirTicketBluetooth(ticket: TicketData) {
  const bluetooth = (navigator as BluetoothNavigator).bluetooth;
  if (!bluetooth) {
    throw new Error("Chrome no habilitó Web Bluetooth en este dispositivo. La impresión directa requiere Chrome Android compatible y conexión HTTPS.");
  }
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: POS_SERVICE_IDS,
  });
  const characteristic = await encontrarCaracteristica(device);
  const bytes = ticketComoEscPos(ticket);
  const tamanioBloque = 180;
  for (let inicio = 0; inicio < bytes.length; inicio += tamanioBloque) {
    const bloque = bytes.slice(inicio, inicio + tamanioBloque);
    if (characteristic.writeValueWithoutResponse && characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(bloque);
    } else {
      await characteristic.writeValue(bloque);
    }
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  return device.name || "impresora Bluetooth";
}