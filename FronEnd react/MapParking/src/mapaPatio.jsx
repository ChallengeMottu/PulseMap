import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

export default function MapaPatio() {
  const [beacons, setBeacons] = useState([]);
  const [svgLines, setSvgLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parkingId, setParkingId] = useState("23");
  const [svgBounds, setSvgBounds] = useState({ minX: 0, maxX: 1200, minY: 0, maxY: 800 });
  const [selectedBeacon, setSelectedBeacon] = useState(null);
  const [motorcycleData, setMotorcycleData] = useState(null);
  const [loadingMotorcycle, setLoadingMotorcycle] = useState(false);
  
  const [credentials, setCredentials] = useState({ 
    email: "", 
    password: "" 
  });
  const [javaLoggedIn, setJavaLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const beaconColors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", 
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
    "#F8C471", "#82E0AA", "#F1948A", "#85C1E9", "#D7BDE2",
    "#A9DFBF", "#F9E79F", "#D2B4DE", "#AED6F1", "#F5B7B1"
  ];

  const getBeaconColor = (mac) => {
    const hash = mac.split(':').reduce((acc, val) => acc + parseInt(val, 16), 0);
    return beaconColors[hash % beaconColors.length];
  };

  const getBeaconSize = (rssi) => {
    if (rssi >= -50) return 12;
    if (rssi >= -60) return 10;
    if (rssi >= -70) return 8;
    return 6;
  };

  const getBeaconOpacity = (rssi) => {
    if (rssi >= -50) return 1.0;
    if (rssi >= -60) return 0.9;
    if (rssi >= -70) return 0.7;
    return 0.5;
  };

  const testJavaConnectivity = async () => {
    try {
      const testResponse = await fetch('{{urlJava}/auth/check}', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (testResponse.ok) {
        const status = await testResponse.text();
        if (status === "Authenticated") {
          setJavaLoggedIn(true);
        }
      }
    } catch (err) {
      console.error('Erro de conectividade Java:', err);
    }
  };

  
  useEffect(() => {
    testJavaConnectivity();
  }, []);

  
  const handleJavaLogin = async (e) => {
    e.preventDefault();
    try {
      setLoginLoading(true);
      setLoginError("");

      
      const formData = new URLSearchParams();
      formData.append('email', credentials.email);
      formData.append('password', credentials.password);

      console.log("📤 Enviando para Java:", {
        url: '{urlJava}/auth/login',
        method: 'POST',
        body: formData.toString(),
        credentials: credentials
      });

      let javaResponse = await fetch('{urlJava}/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include'
      });

      
      if (!javaResponse.ok) {
        javaResponse = await fetch('{urlJava}/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password
          }),
          credentials: 'include'
        });
      }

      if (javaResponse.ok) {
        const javaText = await javaResponse.text();
        setJavaLoggedIn(true);
        setCredentials({ email: "", password: "" });
        
        
        setTimeout(() => {
          testJavaConnectivity();
          if (parkingId) {
            fetchSVG();
          }
        }, 1000);
      } else {
        const javaError = await javaResponse.text();
        throw new Error(`API Java: ${javaError || "Credenciais inválidas"}`);
      }

    } catch (err) {
      console.error('Erro no login:', err);
      setLoginError(err.message || "Erro durante o login");
      setJavaLoggedIn(false);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('{urlJava}/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Erro no logout Java:', err);
    } finally {
      setJavaLoggedIn(false);
      setMotorcycleData(null);
      setSelectedBeacon(null);
      setSvgLines([]);
    }
  };

  const fetchMotorcycleData = async (macAddress) => {
    if (!javaLoggedIn) {
      setMotorcycleData({ needLogin: true });
      return;
    }

    try {
      setLoadingMotorcycle(true);
      setMotorcycleData(null);
      
      const response = await fetch(`{urlJava}/api/beacons/mac/${macAddress}/motorcycle`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.status === 401) {
        setJavaLoggedIn(false);
        setMotorcycleData({ sessionExpired: true });
        return;
      }

      if (response.status === 404) {
        setMotorcycleData({ notFound: true });
        return;
      }

      if (response.status === 204) {
        setMotorcycleData({ notAssociated: true });
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setMotorcycleData(data);
      
    } catch (err) {
      console.error('Erro ao buscar moto:', err);
      setMotorcycleData({ error: err.message });
      
      if (err.message.includes('Failed to fetch') || err.message.includes('Network') || err.message.includes('CORS')) {
        setJavaLoggedIn(false);
      }
    } finally {
      setLoadingMotorcycle(false);
    }
  };

  
  const fetchSVG = async () => {
    try {
      setLoading(true);
      setError(null);

      

      if (!parkingId) {
        setError("Por favor, informe o ID do parking");
        setLoading(false);
        return;
      }

      const response = await fetch(`{urlJava}/parkings/structurePlan/${parkingId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'image/svg+xml',
        },
      });

      if (response.status === 401) {
        setJavaLoggedIn(false);
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      if (response.status === 403) throw new Error("Sem permissão para acessar este recurso");
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);

      const svgText = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, "image/svg+xml");
      
      const lineElements = doc.querySelectorAll("line");
      const lines = Array.from(lineElements).map((line, i) => ({
        x1: parseFloat(line.getAttribute("x1")) || 0,
        y1: parseFloat(line.getAttribute("y1")) || 0,
        x2: parseFloat(line.getAttribute("x2")) || 0,
        y2: parseFloat(line.getAttribute("y2")) || 0,
        stroke: line.getAttribute("stroke") || "#4CAF50",
        strokeWidth: parseFloat(line.getAttribute("stroke-width")) || 2
      }));

      setSvgLines(lines);

      if (lines.length > 0) {
        const allX = lines.flatMap(l => [l.x1, l.x2]);
        const allY = lines.flatMap(l => [l.y1, l.y2]);
        
        setSvgBounds({
          minX: Math.min(...allX),
          maxX: Math.max(...allX),
          minY: Math.min(...allY),
          maxY: Math.max(...allY)
        });
      }

    } catch (err) {
      console.error("Erro ao carregar SVG:", err);
      setError(err.message);
      setSvgLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (javaLoggedIn && parkingId) {
      fetchSVG();
    }
  }, [parkingId, javaLoggedIn]);

  useEffect(() => {
    const handleBeaconsUpdate = (lista) => {
      console.log("Beacons atualizados:", lista);
      setBeacons(lista);
    };

    socket.on("posicoesAtualizadas", handleBeaconsUpdate);
    
    return () => socket.off("posicoesAtualizadas", handleBeaconsUpdate);
  }, []);

  const mapBeaconToSvg = (beacon) => {
    const { minX, maxX, minY, maxY } = svgBounds;
    const contentWidth = maxX - minX || 1200;
    const contentHeight = maxY - minY || 800;
    
    let x = beacon.x || 600;
    let y = beacon.y || 400;
    
    if (contentWidth > 0 && contentHeight > 0) {
      x = minX + ((x / 1200) * contentWidth);
      y = minY + ((y / 800) * contentHeight);
    }
    
    return {
      x: Math.max(20, Math.min(1180, x)),
      y: Math.max(20, Math.min(780, y))
    };
  };

  
  const handleBeaconClick = (beacon) => {
    console.log(`Beacon clicado: ${beacon.mac}`);
    setSelectedBeacon(beacon);
    fetchMotorcycleData(beacon.mac);
  };

 
  const MotorcycleModal = () => {
    if (!selectedBeacon) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '500px',
          width: '100%',
          color: 'white',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '24px' }}>🏍️ Informações da Moto</h2>
            <button 
              onClick={() => {
                setSelectedBeacon(null);
                setMotorcycleData(null);
              }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: '4px'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
            <div style={{ fontWeight: '600', marginBottom: '5px' }}>Beacon Selecionado:</div>
            <div>{selectedBeacon.nome || selectedBeacon.mac}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>RSSI: {selectedBeacon.rssi}</div>
          </div>

          {!javaLoggedIn ? (
            <div style={{ 
              background: 'rgba(255, 152, 0, 0.1)', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔐</div>
              <div style={{ fontWeight: '600', marginBottom: '10px' }}>Login Necessário</div>
              <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '15px' }}>
                Faça login na API Java para ver os dados da moto
              </div>
              <button
                onClick={() => {
                  setSelectedBeacon(null);
                  setMotorcycleData(null);
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>
          ) : loadingMotorcycle ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
              <div>Buscando dados da moto...</div>
            </div>
          ) : motorcycleData?.error ? (
            <div style={{ 
              background: 'rgba(244, 67, 54, 0.1)', 
              padding: '15px', 
              borderRadius: '8px',
              border: '1px solid rgba(244, 67, 54, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>❌</div>
              <div style={{ fontWeight: '600', marginBottom: '10px' }}>Erro na Consulta</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>
                {motorcycleData.error}
              </div>
            </div>
          ) : motorcycleData?.sessionExpired ? (
            <div style={{ 
              background: 'rgba(255, 152, 0, 0.1)', 
              padding: '15px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏰</div>
              <div style={{ fontWeight: '600' }}>Sessão Expirada</div>
              <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '5px' }}>
                Faça login novamente
              </div>
            </div>
          ) : motorcycleData?.notFound ? (
            <div style={{ 
              background: 'rgba(255, 152, 0, 0.1)', 
              padding: '15px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>❓</div>
              <div style={{ fontWeight: '600' }}>Beacon Não Cadastrado</div>
              <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '5px' }}>
                Este MAC address não está cadastrado no sistema
              </div>
            </div>
          ) : motorcycleData?.notAssociated ? (
            <div style={{ 
              background: 'rgba(255, 193, 7, 0.1)', 
              padding: '15px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔌</div>
              <div style={{ fontWeight: '600' }}>Beacon Não Associado</div>
              <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '5px' }}>
                Este beacon não está associado a nenhuma moto
              </div>
            </div>
          ) : motorcycleData?.needLogin ? (
            <div style={{ 
              background: 'rgba(255, 152, 0, 0.1)', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔐</div>
              <div style={{ fontWeight: '600', marginBottom: '10px' }}>Login Necessário</div>
              <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '15px' }}>
                Faça login na API Java para ver os dados da moto
              </div>
            </div>
          ) : motorcycleData ? (
            <div>
              <div style={{ display: 'grid', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600' }}>Placa:</span>
                  <span style={{ 
                    background: 'rgba(76, 175, 80, 0.2)', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}>
                    {motorcycleData.licensePlate}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600' }}>Modelo:</span>
                  <span>{motorcycleData.model || 'Não informado'}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600' }}>Status Operacional:</span>
                  <span style={{ 
                    color: motorcycleData.operationalStatus === 'OPERACIONAL' ? '#4CAF50' : 
                           motorcycleData.operationalStatus === 'EM_MANUTENCAO' ? '#FF9800' : '#F44336',
                    fontWeight: '600',
                    textTransform: 'capitalize'
                  }}>
                    {motorcycleData.operationalStatus ? motorcycleData.operationalStatus.toLowerCase().replace('_', ' ') : 'Não informado'}
                  </span>
                </div>
                
                {motorcycleData.chassisNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '600' }}>Número do Chassi:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {motorcycleData.chassisNumber}
                    </span>
                  </div>
                )}
                
                {motorcycleData.mechanicalCondition && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '600' }}>Condição Mecânica:</span>
                    <span>{motorcycleData.mechanicalCondition}</span>
                  </div>
                )}

                {motorcycleData.parking && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '600' }}>Parking:</span>
                    <span>ID {motorcycleData.parking.id}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  if (!javaLoggedIn) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}>
        <div style={{ 
          padding: "40px", 
          maxWidth: "500px",
          width: "100%",
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          color: "white",
        }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1 style={{ margin: "0 0 10px 0", fontSize: "28px", fontWeight: "600" }}>🗺️ Mapa de Beacons</h1>
            <p style={{ margin: 0, opacity: 0.8 }}>Sistema de monitoramento em tempo real</p>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
              ID do Parking:
            </label>
            <input
              type="number"
              value={parkingId}
              onChange={(e) => setParkingId(e.target.value)}
              placeholder="Digite o ID do parking..."
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "14px"
              }}
            />
          </div>

          <form onSubmit={handleJavaLogin}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                Email:
              </label>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                placeholder="Digite seu email..."
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  fontSize: "14px"
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "25px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                Senha:
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                placeholder="Digite sua senha..."
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  fontSize: "14px"
                }}
                required
              />
            </div>

            {loginError && (
              <div style={{
                background: "rgba(244, 67, 54, 0.1)",
                border: "1px solid rgba(244, 67, 54, 0.3)",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "15px",
                fontSize: "14px"
              }}>
                {loginError}
              </div>
            )}
          
            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                padding: "14px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                transition: "all 0.3s ease",
                opacity: loginLoading ? 0.6 : 1
              }}
            >
              {loginLoading ? "🔄 Entrando..." : "🚀 Entrar no Sistema"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      padding: "20px",
      color: "white"
    }}>
      <MotorcycleModal />
      
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "20px", 
        padding: "20px",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div>
          <h1 style={{ margin: "0 0 5px 0", fontSize: "24px", fontWeight: "600" }}>
            🗺️ Mapa do Pátio - Tempo Real
          </h1>
          <div style={{ fontSize: "14px", opacity: 0.8 }}>
            Parking ID: {parkingId} | Beacons: <span style={{ fontWeight: "600" }}>{beacons.length}</span>
            {selectedBeacon && ` | Selecionado: ${selectedBeacon.nome || selectedBeacon.mac}`}
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ 
              background: javaLoggedIn ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
              color: javaLoggedIn ? '#4CAF50' : '#FF9800',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              border: `1px solid ${javaLoggedIn ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)'}`
            }}>
              {javaLoggedIn ? '✅ Java' : '⚠️ Java'}
            </div>
          </div>

          <button 
            onClick={() => setParkingId("")}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            📝 Alterar Parking
          </button>
          
          <button 
            onClick={handleLogout}
            style={{
              background: "rgba(244, 67, 54, 0.2)",
              color: "#F44336",
              border: "1px solid rgba(244, 67, 54, 0.3)",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            🚪 Sair
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: "rgba(244, 67, 54, 0.1)",
          border: "1px solid rgba(244, 67, 54, 0.3)",
          padding: "15px",
          borderRadius: "8px",
          marginBottom: "20px",
          textAlign: "center"
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "15px", 
        marginBottom: "20px", 
        fontSize: "13px"
      }}>
        <div style={{ 
          padding: "15px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          <div style={{ fontWeight: "600", marginBottom: "8px", color: "#4ECDC4" }}>🎨 Cores dos Beacons</div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>
            Cada beacon tem uma cor fixa para fácil identificação
          </div>
        </div>

        <div style={{ 
          padding: "15px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          <div style={{ fontWeight: "600", marginBottom: "8px", color: "#FFEAA7" }}>📡 Intensidade do Sinal</div>
          <div style={{ fontSize: "12px" }}>
            <div>● <strong>Grande</strong> (RSSI ≥ -50) - Muito perto</div>
            <div>● <strong>Médio</strong> (RSSI -51 a -60) - Perto</div>
            <div>● <strong>Pequeno</strong> (RSSI -61 a -70) - Médio</div>
            <div>● <strong>Muito pequeno</strong> (RSSI ≤ -71) - Longe</div>
          </div>
        </div>

        <div style={{ 
          padding: "15px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          <div style={{ fontWeight: "600", marginBottom: "8px", color: "#96CEB4" }}>👆 Interação</div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>
            {javaLoggedIn 
              ? "Clique em qualquer beacon para ver os dados da moto" 
              : "API Java desconectada - dados das motos não disponíveis"}
          </div>
        </div>
      </div>

      <div style={{
        background: "#1a1a2e",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "20px",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        {loading ? (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "400px",
            fontSize: "18px",
            color: "#b0b0b0"
          }}>
            🔄 Carregando mapa...
          </div>
        ) : (
          <svg width={1200} height={800} style={{ 
            display: "block", 
            margin: "0 auto",
            borderRadius: "8px",
            background: "#16213e"
          }}>
            {svgLines.map((l, i) => (
              <line 
                key={i} 
                x1={l.x1} 
                y1={l.y1} 
                x2={l.x2} 
                y2={l.y2} 
                stroke={l.stroke} 
                strokeWidth={l.strokeWidth} 
              />
            ))}

            {beacons.map((beacon) => {
              const pos = mapBeaconToSvg(beacon);
              const color = getBeaconColor(beacon.mac);
              const size = getBeaconSize(beacon.rssi);
              const opacity = getBeaconOpacity(beacon.rssi);
              const isSelected = selectedBeacon?.mac === beacon.mac;
              
              return (
                <g 
                  key={beacon.mac} 
                  opacity={opacity}
                  onClick={() => handleBeaconClick(beacon)}
                  style={{ 
                    cursor: javaLoggedIn ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    if (javaLoggedIn) {
                      e.target.style.transform = 'scale(1.1)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (javaLoggedIn) {
                      e.target.style.transform = 'scale(1)';
                    }
                  }}
                >
                  <circle 
                    cx={pos.x} 
                    cy={pos.y} 
                    r={size + 4} 
                    fill={color} 
                    fillOpacity={isSelected ? "0.4" : "0.2"}
                    stroke={isSelected ? "#fff" : "none"}
                    strokeWidth={isSelected ? "2" : "0"}
                  />
                  
                  <circle cx={pos.x} cy={pos.y} r={size} fill={color} stroke="#fff" strokeWidth={size > 8 ? 2 : 1} />
                  
                  <circle cx={pos.x} cy={pos.y} r={size / 2} fill="#fff" />
                  
                  <circle cx={pos.x} cy={pos.y} r={size + 8} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
                  
                  <text x={pos.x} y={pos.y - (size + 15)} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#e0e0e0">
                    {beacon.nome || beacon.mac.slice(-5)}
                  </text>
                  <text x={pos.x} y={pos.y + (size + 25)} textAnchor="middle" fontSize="10" fill="#b0b0b0">
                    RSSI: {beacon.rssi}
                  </text>

                  {javaLoggedIn && (
                    <text x={pos.x} y={pos.y + (size + 40)} textAnchor="middle" fontSize="8" fill="#b0b0b0">
                      👆 Clique para detalhes
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      
      <div style={{ 
        padding: "20px", 
        background: "rgba(255,255,255,0.05)", 
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <h3 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
          📋 Beacons Detectados ({beacons.length})
        </h3>
        <div style={{ display: "grid", gap: "10px" }}>
          {beacons.map(beacon => {
            const pos = mapBeaconToSvg(beacon);
            const color = getBeaconColor(beacon.mac);
            const size = getBeaconSize(beacon.rssi);
            
            return (
              <div 
                key={beacon.mac} 
                style={{ 
                  padding: "12px", 
                  background: "rgba(255,255,255,0.05)", 
                  borderRadius: "8px",
                  borderLeft: `4px solid ${color}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  cursor: javaLoggedIn ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  opacity: javaLoggedIn ? 1 : 0.7
                }}
                onMouseOver={(e) => {
                  if (javaLoggedIn) {
                    e.target.style.background = "rgba(255,255,255,0.1)";
                  }
                }}
                onMouseOut={(e) => {
                  if (javaLoggedIn) {
                    e.target.style.background = "rgba(255,255,255,0.05)";
                  }
                }}
                onClick={() => javaLoggedIn && handleBeaconClick(beacon)}
              >
                <div style={{
                  width: "20px",
                  height: "20px",
                  background: color,
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  flexShrink: 0
                }}></div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "600", color: "#e0e0e0", fontSize: "14px" }}>
                        {beacon.nome} 
                      </div>
                      <div style={{ fontSize: "11px", color: "#b0b0b0", marginTop: "2px" }}>
                        {beacon.mac}
                      </div>
                    </div>
                    <div style={{ 
                      background: "rgba(255,255,255,0.1)", 
                      padding: "4px 8px", 
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "#e0e0e0"
                    }}>
                      Tamanho: {size}px
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "15px", marginTop: "8px", fontSize: "11px", color: "#b0b0b0" }}>
                    <span>RSSI: <strong style={{ color: beacon.rssi >= -60 ? "#4CAF50" : "#FF9800" }}>{beacon.rssi}</strong></span>
                    <span>Posição: ({Math.round(pos.x)}, {Math.round(pos.y)})</span>
                    <span>Força: {beacon.rssi >= -50 ? "Excelente" : beacon.rssi >= -60 ? "Boa" : beacon.rssi >= -70 ? "Média" : "Fraca"}</span>
                  </div>
                  {!javaLoggedIn && (
                    <div style={{ marginTop: "5px", fontSize: "10px", color: "#FF9800" }}>
                      ⚠️ API Java desconectada - dados das motos não disponíveis
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}