import express from "express";
import http from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(bodyParser.json());

let beacons = [];


const CLEANUP_INTERVAL = 10000; 
const MAX_INACTIVE_TIME = 15000; 

setInterval(() => {
  const now = Date.now();
  const activeBeacons = beacons.filter(b => now - b.lastUpdate < MAX_INACTIVE_TIME);
  
  if (activeBeacons.length !== beacons.length) {
    console.log(`🧹 Limpando beacons inativos: ${beacons.length - activeBeacons.length} removidos`);
    beacons = activeBeacons;
    io.emit("posicoesAtualizadas", beacons);
  }
}, CLEANUP_INTERVAL);


function mapRSSIToPosition(rssi, mac, existingPosition = null) {
  const centerX = 600;
  const centerY = 400;
  
  const normalizedRssi = Math.min(Math.max(rssi, -90), -30);
  const distance = ((normalizedRssi + 90) / 60) * 300;
  
  const hash = mac.split(':').reduce((acc, val) => acc + parseInt(val, 16), 0);
  const angle = (hash % 360) * (Math.PI / 180);
  
  if (existingPosition) {
    const newX = centerX + Math.cos(angle) * distance;
    const newY = centerY + Math.sin(angle) * distance;
    
    const x = existingPosition.x * 0.7 + newX * 0.3;
    const y = existingPosition.y * 0.7 + newY * 0.3;
    
    return {
      x: Math.min(Math.max(x, 50), 1150),
      y: Math.min(Math.max(y, 50), 750)
    };
  }
  
  const x = centerX + Math.cos(angle) * distance;
  const y = centerY + Math.sin(angle) * distance;
  
  return {
    x: Math.min(Math.max(x, 50), 1150),
    y: Math.min(Math.max(y, 50), 750)
  };
}


app.post("/api/beacon", (req, res) => {
  const { mac, nome, rssi } = req.body;
  console.log("📡 Beacon recebido:", { mac, nome, rssi });

  const index = beacons.findIndex(b => b.mac === mac);
  const now = Date.now();
  
  if (index >= 0) {
    const existingBeacon = beacons[index];
    const novaPosicao = mapRSSIToPosition(rssi, mac, { 
      x: existingBeacon.x, 
      y: existingBeacon.y 
    });
    
    beacons[index] = { 
      ...existingBeacon,
      rssi,
      nome: nome || existingBeacon.nome,
      x: novaPosicao.x,
      y: novaPosicao.y,
      lastUpdate: now,
      updateCount: (existingBeacon.updateCount || 0) + 1
    };
    
    console.log(`🔄 Beacon atualizado: ${mac} | RSSI: ${rssi} | Pos: (${Math.round(novaPosicao.x)}, ${Math.round(novaPosicao.y)})`);
  } else {
    // Novo beacon
    const novaPosicao = mapRSSIToPosition(rssi, mac);
    beacons.push({ 
      mac, 
      nome, 
      rssi, 
      x: novaPosicao.x,
      y: novaPosicao.y,
      lastUpdate: now,
      updateCount: 1,
      firstSeen: now
    });
    
    console.log(`🆕 Novo beacon: ${mac} | RSSI: ${rssi} | Pos: (${Math.round(novaPosicao.x)}, ${Math.round(novaPosicao.y)})`);
  }


  io.emit("posicoesAtualizadas", beacons);

  res.status(200).json({ message: "Beacon recebido com sucesso!" });
});


io.on("connection", socket => {
  console.log("🟢 Cliente conectado no WebSocket");
  socket.emit("posicoesAtualizadas", beacons);
});

server.listen(3001, () =>
  console.log("🚀 Servidor backend rodando em http://localhost:3001")
);