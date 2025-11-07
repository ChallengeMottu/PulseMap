## PulseMap - Sistema de mapeamento em tempo real

---

## 🗺️ Entenda
O **Pulse** é um sistema inteligente de rastreamento e localização utilizando tecnologia **IoT**, composto por dispositivos **Beacon BLE** e **Gateways**.
Por meio do envio de pacote de dados feito pelo Beacon, os Gateways são capazes de predizer localização por meio da força de sinal e triangularização.
Logo, a associação de Beacons e Motos, permite a identificação das motos dentro das filiais e mapeamento em tempo real para monitoramento ativo por parte dos funcionários.

---

## 🔗 Simulação

Este repositório contém uma simulação realista do fluxo Detecção → Mapeamento, demonstrando como funcionará o sistema final.

Para isso, utilizamos:
- Um Beacon BLE físico ou simulado.
- Um ESP32, assumindo o papel de gateway.

O ESP32 captura continuamente os sinais BLE e os envia para um script em Python, que os processa e exibe os dados de identificação e RSSI.

---

## 📡 Sobre os Dispositivos

#### **Beacon BLE**

O Beacon BLE é um pequeno transmissor que emite pacotes de dados em intervalos regulares. Ele normalmente é alimentado por uma bateria modelo CR2032 (3V) e possui baixa demanda energética.

**O que o beacon faz**
Ele transmite continuamente um pacote BLE conhecido como Advertising Packet, que contém:
- UUID (identificador único do beacon)
- Major (identificador do grupo/filial)
- Minor (identificador individual, usado para identificar cada moto)
- RSSI transmitido (Tx Power) — dado usado para calcular distância estimada
- Endereço MAC do beacon

Esses dados permitem:
- Identificação única da moto
- Classificação por filial
- Rastreamento por proximidade
- Cálculo de distância estimada pelo RSSI

<img width="400" height="500" alt="image" src="https://github.com/user-attachments/assets/660987c7-5f49-410e-95a6-1d0254767fca" />



#### **ESP32 (fazendo o papel de Gateway)**

Na simulação, o ESP32 substitui o Gateway físico, pois ele é capaz de:
- Escanear dispositivos BLE próximos
- Detectar anúncios de Beacons
- Filtrar pelo UUID configurado
- Capturar informações como:
    - MAC Address
    - RSSI
    - UUID / Major / Minor
- Enviar via Serial para o Python

**Requisitos para usar o ESP32**
- Instalar a Arduino IDE
- Instalar o pacote da placa ESP32
- Abrir o códig que está dentro da pasta Sketch/ no repositório
- Fazer upload do código para a placa

<img width="400" height="500" alt="image" src="https://github.com/user-attachments/assets/e8f87d95-8c6a-4503-a21e-77b3fcec4f90" />

---

## Fluxo da simulação

```SCSS
Beacon BLE  →  ESP32 (Gateway)  →  Python  →  Backend  →  API Java (pátio SVG)
                                                           ↓
                                                        Front-end
```

---

## 📦 Estrutura do repositório
Uma visão geral dos diretórios principais:

```bash
/
├── Backend/            # Servidor Node.js que recebe dados da simulação
├── Frontend/           # Aplicação React (MapParking)
│   └── MapParking/
├── Sketch/             # Código do ESP32 (Gateway)
├── testePython.py      # Script Python que comunica com o ESP32
└── README.md
```

---


## ▶️ Executando etapas 


### **Camada Python – Processamento Inicial**

Ao executar o sketch na Arduino IDE, o Esp32 agora recebeu um comando de instruções que ele fica executando enquanto estiver conectado na porta da máquina, configurada no código.

Agora a etapa atual é o processamento inicial desses dados enviados, designado pelo script desenvolvido em Python.

Esse script desempenha o papel de receber via serial os dados enviados pelo ESP32, validar e formatar as informações e enviar para o Backend, via HTTP, um payload de dados do que está
sendo detectado pelo Esp32.

O script de Python é o arquivo **testePython.py**.



### **Backend – Camada de Inteligência e Integração**

Para executar o script Python, é necessário estar com a camada Backend no ar. Ela encontra-se na pasta "Backend", e trata-se de um servidor node que recebe e valida os beacons que estão
sendo detectados.

Tem como principais responsabilidades:
- Receber os dados enviados pelo Python
- Armazenar e atualizar a localização de cada beacon


### **API Java – Estrutura do Pátio em SVG**

Para a construção de uma estrutura real da planta baixa do pátio, o Front End precisa estar integrado a API JAVA para consulta de dados no banco.

No banco de dados temos dados pré-cadastrados manualmente e advindo de outros sistemas. Dentre esses dados, há a estrutura do pátio em formato SVG, 
e motos cadastradas para a consulta em pátio.

Logo, a API retorna:
- A planta do pátio em SVG
- A organização dos espaços
- Coordenadas pré-mapeadas para posicionamento

Esse SVG funciona como o mapa-base para posicionar as motos detectadas.

Link repositório Api Java: https://github.com/ChallengeMottu/API_Java_Pulse.git



### **Front-End – Mapeamento Visual em Tempo Real**
A camada de Front end encontrase na pasta "Frontend", sendo o projeto "MapParking". Trata-se de uma aplicação web desenvolvida com React.
Funcionalidades do Front-end:
- Carrega o SVG do pátio via API Java
- Requisita ao backend a lista de todos os beacons detectados
- Renderiza cada beacon no ponto que o backend indicar
- Quando o usuário clica em uma moto no mapa, exibe:
    - Dados do veículo (modelo, placa, chassi, etc.)
    - Informações de atualização
    - Status (ativo, em manutenção, fora da filial)
 

**Como Rodar o Front-End (React)**

- **Pré-requisitos:**
Antes de rodar o projeto, certifique-se de ter instalado:
- Node.js (versão 18+ recomendada)
- npm (instalado junto com o Node)

Verifique suas versões com:
```bash
node -v
npm -v
```

**Passo a Passo para Rodar:**
1. Navegue até a pasta do front-end:
```bash
cd Frontend/MapParking
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

4. Acesse no navegador:
```bash
http://localhost:5173
```

O resultado é um mapa interativo e atualizado em tempo real, totalmente integrado ao ecossistema IoT.

**Resultado:** <img>

---

## 👥 Grupo desenvolvedor
- Gabriela de Sousa Reis - RM558830
- Laura Amadeu Soares - RM556690
- Raphael Lamaison Kim - RM557914










