const express = require('express');
const oracledb = require('oracledb');

const app = express();

// ========================
// CONFIGURACIÓN PERSONALIZADA
// ========================
const dbConfig = {
  user: "ADMIN",
  password: "Yer-Ale061024",
  connectString: "(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.mx-queretaro-1.oraclecloud.com))(connect_data=(service_name=g7d0a109709d57d_bc27bncudfcgiclb_tp.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))"
};

const walletPath = 'C:\\Users\\solan\\Documents\\wallet';
// ========================

// Configurar el wallet
process.env.TNS_ADMIN = walletPath;

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_0' });
} catch (err) {
  console.error('Error al iniciar Oracle Client:', err);
  process.exit(1);
}

// Middleware
app.use(express.json());

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.send('🎉 ¡Backend para Oracle Cloud Funcionando!');
});

// Ruta para probar la conexión a la BD
app.get('/api/test-db', async (req, res) => {
  let connection;
  try {
    console.log('Intentando conectar a Oracle Cloud...');
    connection = await oracledb.getConnection(dbConfig);
    
    const result = await connection.execute(
      `SELECT '¡Conexión Exitosa a Oracle Cloud!' AS mensaje FROM DUAL`
    );
    
    console.log('✅ Conexión exitosa');
    res.json({ 
      exito: true, 
      detalle: result.rows[0][0] 
    });
    
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    res.status(500).json({ 
      exito: false, 
      error: err.message 
    });
  } finally {
    if (connection) {
      try { 
        await connection.close(); 
      } catch (e) { 
        console.error('Error al cerrar conexión:', e); 
      }
    }
  }
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log('📁 Wallet en:', walletPath);
  console.log('🔗 Connect String configurado');
});