import { Buffer } from 'buffer';
import { BleManager } from 'react-native-ble-plx';
import type { Device, Subscription } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

const BLE_SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
const BLE_COMMAND_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';
const BLE_TELEMETRY_UUID = '0000FFE2-0000-1000-8000-00805F9B34FB';

// Keep the names used by the existing helmet and relay firmware.
const SUPPORTED_DEVICE_NAMES = new Set([
  'SMART_BIKE_S3',
  'SMART_HELMET_S3',
  'HELMET_S3',
]);

const bleManager = new BleManager();

type HelmetTelemetry = Record<string, unknown>;

export default function useHelmetBle(onTelemetry: (data: HelmetTelemetry) => void) {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeviceModalVisible, setIsDeviceModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedDeviceRef = useRef<Device | null>(null);
  const monitorRef = useRef<Subscription | null>(null);
  const disconnectRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    bleManager.stopDeviceScan();
    setIsScanning(false);
  }, []);

  const clearConnection = useCallback(() => {
    monitorRef.current?.remove();
    monitorRef.current = null;
    disconnectRef.current?.remove();
    disconnectRef.current = null;
    connectedDeviceRef.current = null;
    setConnectedDevice(null);
    setIsConnecting(false);
  }, []);

  useEffect(() => () => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    bleManager.stopDeviceScan();
    monitorRef.current?.remove();
    disconnectRef.current?.remove();
    const device = connectedDeviceRef.current;
    connectedDeviceRef.current = null;
    if (device) void bleManager.cancelDeviceConnection(device.id).catch(() => undefined);
  }, []);

  const requestBluetoothPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return (
          results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      }

      const locationResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return locationResult === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const startScan = useCallback(async () => {
    if (isScanning || isConnecting) return;
    setError(null);
    setScannedDevices([]);
    setIsDeviceModalVisible(true);

    const permissionsGranted = await requestBluetoothPermissions();
    if (!permissionsGranted) {
      setError('Cần cấp quyền thiết bị ở gần để quét Bluetooth.');
      return;
    }

    try {
      const bluetoothState = await bleManager.state();
      if (bluetoothState !== 'PoweredOn') {
        setError('Hãy bật Bluetooth trên điện thoại rồi thử lại.');
        return;
      }

      bleManager.stopDeviceScan();
      setIsScanning(true);
      bleManager.startDeviceScan(null, { allowDuplicates: false }, (scanError, device) => {
        if (scanError) {
          setError('Không thể quét Bluetooth. Hãy kiểm tra Bluetooth và thử lại.');
          stopScan();
          return;
        }

        if (!device?.name || !SUPPORTED_DEVICE_NAMES.has(device.name)) return;
        setScannedDevices((current) => (
          current.some((item) => item.id === device.id) ? current : [...current, device]
        ));
      });

      scanTimeoutRef.current = setTimeout(stopScan, 10000);
    } catch {
      setIsScanning(false);
      setError('Không thể bắt đầu quét Bluetooth.');
    }
  }, [isConnecting, isScanning, requestBluetoothPermissions, stopScan]);

  const connectToDevice = useCallback(async (device: Device) => {
    stopScan();
    setError(null);
    const oldDevice = connectedDeviceRef.current;
    if (oldDevice) {
      clearConnection();
      await bleManager.cancelDeviceConnection(oldDevice.id).catch(() => undefined);
    }
    setIsConnecting(true);

    try {
      let connected = await device.connect({ timeout: 12000 });
      if (Platform.OS === 'android') {
        try {
          connected = await connected.requestMTU(247);
        } catch {
          // The helmet may use the Android default MTU.
        }
      }

      connected = await connected.discoverAllServicesAndCharacteristics();
      const characteristics = await connected.characteristicsForService(BLE_SERVICE_UUID);
      const hasCommand = characteristics.some((item) => item.uuid.toLowerCase() === BLE_COMMAND_UUID.toLowerCase());
      const hasTelemetry = characteristics.some((item) => item.uuid.toLowerCase() === BLE_TELEMETRY_UUID.toLowerCase());
      if (!hasCommand || !hasTelemetry) {
        throw new Error('Không tìm thấy cổng dữ liệu của Helmet Node.');
      }

      connectedDeviceRef.current = connected;
      setConnectedDevice(connected);
      setIsDeviceModalVisible(false);
      monitorRef.current = connected.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_TELEMETRY_UUID,
        (monitorError, characteristic) => {
          if (monitorError || !characteristic?.value) return;
          try {
            const json = Buffer.from(characteristic.value, 'base64').toString('utf8');
            const data = JSON.parse(json);
            if (data && typeof data === 'object' && !Array.isArray(data)) {
              onTelemetryRef.current(data as HelmetTelemetry);
            }
          } catch {
            setError('Dữ liệu BLE từ nón không đúng định dạng JSON.');
          }
        },
      );
      disconnectRef.current = connected.onDisconnected(() => {
        clearConnection();
      });
    } catch (connectionError) {
      await bleManager.cancelDeviceConnection(device.id).catch(() => undefined);
      clearConnection();
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : 'Không thể kết nối Helmet Node qua Bluetooth.',
      );
    } finally {
      setIsConnecting(false);
    }
  }, [clearConnection, stopScan]);

  const sendCommand = useCallback(async (command: number) => {
    const device = connectedDeviceRef.current;
    if (!device) throw new Error('Chưa kết nối Bluetooth với Helmet Node.');

    await device.writeCharacteristicWithResponseForService(
      BLE_SERVICE_UUID,
      BLE_COMMAND_UUID,
      Buffer.from([command]).toString('base64'),
    );
  }, []);

  const disconnect = useCallback(async () => {
    const device = connectedDeviceRef.current;
    clearConnection();
    if (device) await bleManager.cancelDeviceConnection(device.id).catch(() => undefined);
  }, [clearConnection]);

  const closeDeviceModal = useCallback(() => {
    stopScan();
    setIsDeviceModalVisible(false);
    setError(null);
  }, [stopScan]);

  return {
    connectedDevice,
    scannedDevices,
    isScanning,
    isConnecting,
    isDeviceModalVisible,
    error,
    startScan,
    connectToDevice,
    sendCommand,
    disconnect,
    closeDeviceModal,
  };
}
