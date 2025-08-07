const { spawn } = require('child_process');
const chalk = require('chalk');

let miningProcess = null;
let authProcess = null;
let isAuthRunning = false;

// Fungsi logging berwarna
function logInfo(msg) {
  console.log(chalk.blue('[INFO]'), msg);
}

function logSuccess(msg) {
  console.log(chalk.green('[SUCCESS]'), msg);
}

function logError(msg) {
  console.log(chalk.red('[ERROR]'), msg);
}

function logController(msg) {
  console.log(chalk.magenta('[CONTROLLER]'), msg);
}

// Mulai mining.js
function startMining() {
  logController('Starting mining.js...');
  miningProcess = spawn('node', ['mining.js'], {
    env: { ...process.env, FORCE_COLOR: '1' }, // memaksa chalk tetap aktif
  });

  miningProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output); // tampilkan langsung (dengan warna jika ada)

    // Deteksi error login
    if (
      output.includes('"status": 401') ||
      output.includes('❌ Login: False') ||
      output.toLowerCase().includes('unauthorized')
    ) {
      logError('Unauthorized output detected. Stopping mining.js...');
      stopProcess(miningProcess);
      startAuth();
    }
  });

  miningProcess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  miningProcess.on('close', (code) => {
    logController(`mining.js exited with code ${code}`);
    if (code === 1) {
      logError('Detected Unauthorized exit. Starting auth.js...');
      startAuth();
    }
  });
}

// Mulai auth.js
function startAuth() {
  if (isAuthRunning) return;

  isAuthRunning = true;
  logController('Starting auth.js...');
  authProcess = spawn('node', ['auth.js'], {
    env: { ...process.env, FORCE_COLOR: '1' }, // aktifkan warna juga
  });

  authProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (output.includes('Encoded message saved to q.txt')) {
      logSuccess('Auth success. Restarting mining.js...');
      stopProcess(authProcess);
      isAuthRunning = false;
      startMining();
    }
  });

  authProcess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  authProcess.on('close', (code) => {
    logController(`auth.js exited with code ${code}`);
    isAuthRunning = false;
  });
}

// Hentikan proses (dengan safety check)
function stopProcess(proc) {
  if (proc && !proc.killed) {
    try {
      process.kill(proc.pid, 'SIGTERM');
    } catch (err) {
      logError(`Error killing process: ${err.message}`);
    }
  }
}

// Jalankan pertama kali
startMining();
