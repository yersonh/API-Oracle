require('dotenv').config();
const express = require('express');
const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

const app = express();

// ========================
// CONFIGURAR WALLET (COMO PHP)
// ========================
const walletPath = process.env.TNS_ADMIN || '/tmp/wallet';

if (!fs.existsSync(walletPath)) {
  fs.mkdirSync(walletPath, { recursive: true });
}

function writeWalletFile(filePath, encodedContent, walletLocation = null) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return;
  }

  let decoded = Buffer.from(encodedContent, 'base64');

  // Si sqlnet.ora, corregir ruta del wallet
  if (filePath.endsWith('sqlnet.ora') && walletLocation) {
    let content = decoded.toString('utf8');
    content = content.replace(/DIRECTORY\s*=\s*"[^"]*"/i, `DIRECTORY="${walletLocation}"`);
    decoded = Buffer.from(content, 'utf8');
  }

  fs.writeFileSync(filePath, decoded);
  fs.chmodSync(filePath, 0o600);
}

function writeEwalletFile(walletPath, encodedContent) {
  const pemPath = path.join(walletPath, 'ewallet.pem');
  const p12Path = path.join(walletPath, 'ewallet.p12');

  if ((fs.existsSync(pemPath) && fs.statSync(pemPath).size > 0) ||
      (fs.existsSync(p12Path) && fs.statSync(p12Path).size > 0)) {
    return;
  }

  let decoded = Buffer.from(encodedContent, 'base64');
  const content = decoded.toString('utf8');

  const fileName = content.trimStart().startsWith('-----BEGIN') ? 'ewallet.pem' : 'ewallet.p12';
  const filePath = path.join(walletPath, fileName);

  fs.writeFileSync(filePath, decoded);
  fs.chmodSync(filePath, 0o600);
}

function getTnsAliases(tnsnamesPath) {
  if (!fs.existsSync(tnsnamesPath)) return [];
  const content = fs.readFileSync(tnsnamesPath, 'utf8').replace(/^\uFEFF/, '');
  const regex = /^\s*([A-Za-z0-9_.-]+)\s*=/gm;
  const aliases = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    aliases.push(match[1]);
  }
  return aliases;
}

function resolveConnectIdentifier(configuredIdentifier, tnsnamesPath) {
  const aliases = getTnsAliases(tnsnamesPath);

  if (aliases.includes(configuredIdentifier)) {
    return configuredIdentifier;
  }

  const lowerIdentifier = configuredIdentifier.toLowerCase();
  for (const alias of aliases) {
    if (alias.toLowerCase() === lowerIdentifier) {
      return alias;
    }
  }

  const highAliases = aliases.filter(a => a.toLowerCase().endsWith('_high'));
  if (highAliases.length === 1) {
    return highAliases[0];
  }

  return configuredIdentifier;
}

// Escribir archivos del wallet (IGUAL QUE PHP)
if (process.env.WALLET_CWALLET_B64) {
  writeWalletFile(path.join(walletPath, 'cwallet.sso'), process.env.WALLET_CWALLET_B64, null);
}
if (process.env.WALLET_EWALLET_B64) {
  writeEwalletFile(walletPath, process.env.WALLET_EWALLET_B64);
}
if (process.env.WALLET_SQLNET_B64) {
  writeWalletFile(path.join(walletPath, 'sqlnet.ora'), process.env.WALLET_SQLNET_B64, walletPath);
}
if (process.env.WALLET_TNSNAMES_B64) {
  writeWalletFile(path.join(walletPath, 'tnsnames.ora'), process.env.WALLET_TNSNAMES_B64);
}

// Configurar TNS_ADMIN
process.env.TNS_ADMIN = walletPath;

// Resolver el identificador de conexión
const tnsIdentifier = process.env.ORACLE_TNS || process.env.DB_CONNECT_STRING || '';
const connectString = tnsIdentifier;

console.log('📁 Wallet en:', walletPath);
console.log('🔗 Connect identifier:', connectString);

// ========================
// CONFIGURACIÓN DB
// ========================
const dbConfig = {
  user: process.env.ORACLE_USER || process.env.DB_USER,
  password: process.env.ORACLE_PASSWORD || process.env.DB_PASSWORD,
  connectString: connectString
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
  try {
    oracledb.initOracleClient({ libDir: '/opt/oracle/instantclient_21_10' });
    console.log('✅ Oracle Client inicializado (Linux)');
  } catch (e) {
    console.error('❌ Error al iniciar Oracle Client en Linux:', e.message);
  }
}

// ========================
// MIDDLEWARE
// ========================
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    console.log('🔄 Conectando a Oracle Cloud...');
    console.log('📋 Config:', { user: dbConfig.user, connectString: dbConfig.connectString });
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `SELECT '¡Conexión Exitosa a Oracle Cloud!' AS mensaje FROM DUAL`
    );

    console.log('✅ Conexión exitosa');
    res.json({ exito: true, detalle: result.rows[0][0] });

  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ exito: false, error: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
});

app.post('/api/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ exito: false, error: 'Usuario y contraseña requeridos' });
    }

    console.log(`🔑 Intentando login: ${username}`);
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `SELECT u.ID_USUARIO, u.ID_PERSONA, u.id_tipo, u.username, u.estado
       FROM ADMIN.USUARIO u
       WHERE u.username = :username 
         AND u.password = :password
         AND UPPER(u.estado) = 'Activo'`,
      [username, password]
    );

    if (result.rows.length > 0) {
      const usuario = result.rows[0];
      res.json({
        exito: true,
        mensaje: 'Inicio de sesión exitoso',
        usuario: {
          id_usuario: usuario[0],
          id_persona: usuario[1],
          id_tipo: usuario[2],
          username: usuario[3],
          estado: usuario[4]
        }
      });
    } else {
      res.status(401).json({ exito: false, error: 'Usuario o contraseña incorrectos' });
    }

  } catch (err) {
    console.error('❌ Error en login:', err.message);
    res.status(500).json({ exito: false, error: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
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
});