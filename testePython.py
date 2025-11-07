import serial
import requests

url = "http://localhost:3001/api/beacon"


ser = serial.Serial('COM5', 115200, timeout=1)

print("Lendo dados do ESP32...\n")

while True:
    line = ser.readline().decode(errors='ignore').strip()

    if not line:
        continue

    
    if line.count(',') != 2:
        print("Ignorando:", line)
        continue

    try:
        name, mac, rssi = line.split(',')
        data = {
            "nome": name,
            "mac": mac,
            "rssi": int(rssi)
        }


        response = requests.post(url, json=data)
        print("Enviado:", data, "| Status:", response.status_code)

    except Exception as e:
        print("Erro ao processar linha:", line, e)
