export interface AcquisitionCommand {
  mode: 'Linear' | 'Rotation';
  distanceMm: number | null;
  angleDeg: number | null;
  speed: number | null;
  repetitions: number | null;
}

export interface SignalChunk {
  repetition: number;
  sequence: number;
  samples: number[];
}

interface ConnectOptions {
  onDeviceStatusChange?: (status: string) => void;
  onSignalChunk?: (chunk: SignalChunk) => void;
  onRepetitionDone?: (repetition: number) => void;
  onAcquisitionDone?: () => void;
  onDisconnect?: () => void;
}

type StatusCallback = (status: string) => void;

interface BluetoothRemoteGATTCharacteristicLike {
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: Event) => void
  ): void;
  writeValue(value: BufferSource): Promise<void>;
  value?: DataView;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristicLike>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServerLike>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTServiceLike>;
}

interface BluetoothDeviceLike extends EventTarget {
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

interface BluetoothNavigatorLike {
  requestDevice(options: {
    filters?: Array<{ name?: string; namePrefix?: string; services?: string[] }>;
    optionalServices?: string[];
  }): Promise<BluetoothDeviceLike>;
}

// Nordic UART Service UUIDs. These must match the ESP32 firmware.
// RX = Web -> ESP32. TX = ESP32 -> Web.
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const DEVICE_NAME = 'ESP32S3-Interferometer';

const COMMAND_START_ACQUISITION = 0x01;
const MODE_LINEAR = 0x01;
const MODE_ROTATION = 0x02;

// ESP32 -> Web packet types.
// 0x10: signal chunk: [type,u8 repetition,u16 sequence,u8 sampleCount,int16 samples...]
// 0x11: repetition done: [type,u8 repetition]
// 0x12: acquisition done: [type]
const MESSAGE_SIGNAL_CHUNK = 0x10;
const MESSAGE_REPETITION_DONE = 0x11;
const MESSAGE_ACQUISITION_DONE = 0x12;

let device: BluetoothDeviceLike | null = null;
let server: BluetoothRemoteGATTServerLike | null = null;
let rxCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
let txCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
let activeStatusCallback: StatusCallback | undefined;
let activeSignalChunkCallback: ((chunk: SignalChunk) => void) | undefined;
let activeRepetitionDoneCallback: ((repetition: number) => void) | undefined;
let activeAcquisitionDoneCallback: (() => void) | undefined;
let activeDisconnectCallback: (() => void) | undefined;

const normalizeConnectOptions = (optionsOrCallback?: ConnectOptions | StatusCallback): ConnectOptions => {
  if (typeof optionsOrCallback === 'function') {
    return { onDeviceStatusChange: optionsOrCallback };
  }

  return optionsOrCallback ?? {};
};

const getBluetooth = (): BluetoothNavigatorLike => {
  const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothNavigatorLike }).bluetooth;

  if (!bluetooth) {
    throw new Error('Web Bluetooth is not supported. Use Chrome or Edge on localhost/HTTPS.');
  }

  return bluetooth;
};

const textToArrayBuffer = (message: string): ArrayBuffer => {
  const bytes = new TextEncoder().encode(message);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const decodeValue = (value?: DataView): string => {
  if (!value) return '';

  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new TextDecoder().decode(bytes);
};

const emitStatus = (status: string): void => {
  activeStatusCallback?.(status);
};

const ensureConnected = (): BluetoothRemoteGATTCharacteristicLike => {
  if (!rxCharacteristic || !server?.connected) {
    throw new Error('ESP32-S3 is not connected.');
  }

  return rxCharacteristic;
};

const writeText = async (message: string): Promise<void> => {
  const characteristic = ensureConnected();

  console.log('[WEB -> ESP32 text]', message);
  await characteristic.writeValue(textToArrayBuffer(message));
};

const writeBinary = async (buffer: ArrayBuffer): Promise<void> => {
  const characteristic = ensureConnected();

  console.log('[WEB -> ESP32 binary]', Array.from(new Uint8Array(buffer)));
  await characteristic.writeValue(buffer);
};

const buildStartPayload = (command: AcquisitionCommand): ArrayBuffer => {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);

  view.setUint8(0, COMMAND_START_ACQUISITION);
  view.setUint8(1, command.mode === 'Linear' ? MODE_LINEAR : MODE_ROTATION);

  // Little-endian format. ESP32-S3 is little-endian too.
  view.setFloat32(2, command.mode === 'Linear' ? command.distanceMm ?? 0 : 0, true);
  view.setFloat32(6, command.mode === 'Rotation' ? command.angleDeg ?? 0 : 0, true);
  view.setFloat32(10, command.speed ?? 0, true);
  view.setUint16(14, command.repetitions ?? 0, true);

  return buffer;
};

const handleIncomingNotification = (value?: DataView): void => {
  if (!value || value.byteLength === 0) return;

  const messageType = value.getUint8(0);

  if (messageType === MESSAGE_SIGNAL_CHUNK) {
    const chunk = parseSignalChunk(value);

    if (chunk) {
      console.info('[ESP32-S3 -> WEB signal]', chunk);
      activeSignalChunkCallback?.(chunk);
    }

    return;
  }

  if (messageType === MESSAGE_REPETITION_DONE) {
    const repetition = value.byteLength >= 2 ? value.getUint8(1) : 1;
    console.info('[ESP32-S3 -> WEB]', `REPETITION_DONE ${repetition}`);
    emitStatus(`Repetition ${repetition} received`);
    activeRepetitionDoneCallback?.(repetition);
    return;
  }

  if (messageType === MESSAGE_ACQUISITION_DONE) {
    console.info('[ESP32-S3 -> WEB]', 'ACQUISITION_DONE');
    emitStatus('Acquisition data received');
    activeAcquisitionDoneCallback?.();
    return;
  }

  const message = decodeValue(value);

  if (!message) return;

  console.info('[ESP32-S3 -> WEB]', message);
  emitStatus(message);

  if (message === 'ACQUISITION_DONE') {
    activeAcquisitionDoneCallback?.();
  }
};

const parseSignalChunk = (value: DataView): SignalChunk | null => {
  if (value.byteLength < 5) {
    emitStatus('Invalid signal chunk received');
    return null;
  }

  const repetition = Math.max(1, value.getUint8(1));
  const sequence = value.getUint16(2, true);
  const declaredSampleCount = value.getUint8(4);
  const availableSampleCount = Math.floor((value.byteLength - 5) / 2);
  const sampleCount = Math.min(declaredSampleCount, availableSampleCount);
  const samples: number[] = [];

  for (let index = 0; index < sampleCount; index++) {
    samples.push(value.getInt16(5 + index * 2, true));
  }

  return {
    repetition,
    sequence,
    samples
  };
};

export const connectToInterferometerBle = async (optionsOrCallback?: ConnectOptions | StatusCallback) => {
  const options = normalizeConnectOptions(optionsOrCallback);
  activeStatusCallback = options.onDeviceStatusChange;
  activeSignalChunkCallback = options.onSignalChunk;
  activeRepetitionDoneCallback = options.onRepetitionDone;
  activeAcquisitionDoneCallback = options.onAcquisitionDone;
  activeDisconnectCallback = options.onDisconnect;

  const bluetooth = getBluetooth();

  emitStatus('Searching for ESP32-S3...');

  device = await bluetooth.requestDevice({
    filters: [{ name: DEVICE_NAME }],
    optionalServices: [SERVICE_UUID]
  });

  device.addEventListener('gattserverdisconnected', () => {
    device = null;
    server = null;
    rxCharacteristic = null;
    txCharacteristic = null;

    emitStatus('Device disconnected');
    activeDisconnectCallback?.();
  });

  if (!device.gatt) {
    throw new Error('Selected Bluetooth device does not expose GATT.');
  }

  emitStatus('Connecting to ESP32-S3...');

  server = await device.gatt.connect();

  const service = await server.getPrimaryService(SERVICE_UUID);
  rxCharacteristic = await service.getCharacteristic(RX_CHARACTERISTIC_UUID);
  txCharacteristic = await service.getCharacteristic(TX_CHARACTERISTIC_UUID);

  await txCharacteristic.startNotifications();

  txCharacteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
    const target = event.target as unknown as BluetoothRemoteGATTCharacteristicLike;
    handleIncomingNotification(target.value);
  });

  await writeText('WEB_CONNECTED');

  const deviceName = device.name ?? 'ESP32-S3';
  emitStatus(`Connected to ${deviceName}`);

  return {
    deviceName
  };
};

export const disconnectInterferometerBle = (): void => {
  if (server?.connected) {
    server.disconnect();
  }

  device = null;
  server = null;
  rxCharacteristic = null;
  txCharacteristic = null;
  activeSignalChunkCallback = undefined;
  activeRepetitionDoneCallback = undefined;
  activeAcquisitionDoneCallback = undefined;

  emitStatus('Device disconnected');
};

export const sendAcquisitionStart = async (command: AcquisitionCommand): Promise<void> => {
  await writeBinary(buildStartPayload(command));
};

// Compatibility alias for App.tsx versions that import this name.
export const sendStartAcquisitionCommand = sendAcquisitionStart;

export const isInterferometerBleConnected = (): boolean => {
  return Boolean(server?.connected && rxCharacteristic);
};
