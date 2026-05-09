require('dotenv').config();
const express = require('express');
const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

const app = express();

// ========================
// CONFIGURAR WALLET
// ========================
let walletPath;

if (process.env.WALLET_BASE64 === 'true') {
  // ESTAMOS EN RAILWAY
  console.log('🔐 Configurando wallet desde Base64...');
  walletPath = '/tmp/wallet';
  
  if (!fs.existsSync(walletPath)) {
    fs.mkdirSync(walletPath, { recursive: true });
  }

  const archivos = {
    'cwallet.sso': process.env.WALLET_CWALLET_SSO,
    'ewallet.p12': process.env.WALLET_EWALLET_P12,
    'keystore.jks': process.env.WALLET_KEYSTORE_JKS,
    'truststore.jks': process.env.WALLET_TRUSTSTORE_JKS,
    'sqlnet.ora': process.env.WALLET_SQLNET_ORA,
    'tnsnames.ora': process.env.WALLET_TNSNAMES_ORA
  };

  for (const [nombre, contenido] of Object.entries(archivos)) {
    if (contenido) {
      const buffer = Buffer.from(contenido, 'base64');
      fs.writeFileSync(path.join(walletPath, nombre), buffer);
      console.log(`✅ ${nombre} creado`);
    }
  }
} else {
  // ESTAMOS EN LOCAL
  walletPath = 'C:\\Users\\solan\\Documents\\wallet';
  console.log('💻 Usando wallet local:', walletPath);
}

process.env.TNS_ADMIN = walletPath;

// ========================
// CONFIGURACIÓN DB
// ========================
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
};

// ========================
// INICIALIZAR ORACLE CLIENT
// ========================
const isWindows = process.platform === 'win32';
if (isWindows) {
  try {
    oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_0' });
    console.log('✅ Oracle Client inicializado (Windows)');
  } catch (err) {
    console.error('Error al iniciar Oracle Client:', err);
    process.exit(1);
  }
} else {
  console.log('🐧 Linux/Railway - omitiendo initOracleClient');
}

// ========================
// MIDDLEWARE
// ========================
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ========================
// RUTAS
// ========================
app.get('/', (req, res) => {
  res.json({ mensaje: '🎉 API Backend Oracle Cloud Funcionando', status: 'online' });
});

app.get('/api/test-db', async (req, res) => {
  let connection;
  try {
    console.log('Intentando conectar a Oracle Cloud...');
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `SELECT '¡Conexión Exitosa a Oracle Cloud!' AS mensaje FROM DUAL`
    );

    console.log('✅ Conexión exitosa');
    res.json({ exito: true, detalle: result.rows[0][0] });

  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    res.status(500).json({ exito: false, error: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// ========================
// INICIAR SERVIDOR
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log('📁 Wallet en:', walletPath);
});
app.post('/api/login', async (req, res) => {
  let connection;

  try {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Usuario y contraseña son obligatorios'
      });
    }

    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `
      SELECT
        ID_USUARIO,
        USERNAME,
        ID_TIPO,
        ESTADO,
        ID_PERSONA,
        NOMBRES,
        APELLIDOS,
        CORREO,
        TELEFONO,
        DIRECCION
      FROM V_USUARIO_COMPLETO
      WHERE USERNAME = :usuario
      AND PASSWORD = :contrasena
      AND UPPER(ESTADO) = 'ACTIVO'
      `,
      {
        usuario,
        contrasena
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    if (result.rows.length > 0) {
      return res.json({
        exito: true,
        mensaje: 'Login correcto',
        usuario: result.rows[0]
      });
    }

    return res.status(401).json({
      exito: false,
      mensaje: 'Usuario o contraseña incorrectos'
    });

  } catch (err) {
    console.error('❌ Error en login:', err.message);

    return res.status(500).json({
      exito: false,
      mensaje: 'Error en login',
      error: err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error(e);
      }
    }
  }
});