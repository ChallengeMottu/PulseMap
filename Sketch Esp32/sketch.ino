#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

int scanTime = 5; 
BLEScan* pBLEScan;

#define MAX_DEVICES 20
struct DeviceInfo {
  char mac[18];
  char name[32]; 
  int rssi;
};
DeviceInfo devices[MAX_DEVICES];
int deviceCount = 0;


#define TARGET_UUID "FDA50693-A4E2-4FB1-AFCF-C6EB07647825"  


class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if(deviceCount >= MAX_DEVICES) return;

    if(advertisedDevice.haveManufacturerData()) {
      String data = advertisedDevice.getManufacturerData(); 
      if(data.length() >= 25) { 
        uint8_t* bytes = (uint8_t*)data.c_str();
        char uuidStr[37]; 
        sprintf(uuidStr,
            "%02X%02X%02X%02X-%02X%02X-%02X%02X-%02X%02X-%02X%02X%02X%02X%02X%02X",
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9],
            bytes[10], bytes[11],
            bytes[12], bytes[13],
            bytes[14], bytes[15], bytes[16], bytes[17],
            bytes[18], bytes[19]
        );

        
        if(strcmp(uuidStr, TARGET_UUID) == 0) {
            snprintf(devices[deviceCount].mac, 18, "%s", advertisedDevice.getAddress().toString().c_str());
            advertisedDevice.haveName() ? 
              snprintf(devices[deviceCount].name, 32, "%s", advertisedDevice.getName().c_str()) :
              snprintf(devices[deviceCount].name, 32, "N/A");
            devices[deviceCount].rssi = advertisedDevice.getRSSI();
            deviceCount++;
        }
      }
    }
  }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Inicializando BLE Scanner...");

  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true); 
}

void loop() {
  deviceCount = 0;

  // Inicia scan BLE
  pBLEScan->start(scanTime, false);

  // Envia beacons filtrados para o Python
  for(int i = 0; i < deviceCount; i++){
    Serial.print(devices[i].name);
    Serial.print(",");
    Serial.print(devices[i].mac);
    Serial.print(",");
    Serial.println(devices[i].rssi);
  }

  pBLEScan->clearResults();
  delay(2000); 
}

