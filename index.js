const axios = require('axios');
const fs = require('fs').promises;
const chalk = require('chalk');

// Konfigurasi
const MIN_MINUTES = 5; // Minimal menit untuk delay random
const MAX_MINUTES = 15; // Maksimal menit untuk delay random
const QUERY_FILE = 'query.txt'; // File query_id
const LOGIN_URL = 'https://api.cross-play.xyz/users/login';
const CLAIM_URL = 'https://api.cross-play.xyz/users/golds/claim';
const CHARACTER_INFO_URL = 'https://api.cross-play.xyz/characters/character-info';
const STEP_DELAY = 2000; // Jeda 2 detik (2000 ms) antar tahap

// Header dasar
const headers = {
  'content-type': 'application/json',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  'accept': '*/*',
  'origin': 'https://app.cross-play.xyz',
  'sec-fetch-site': 'same-site',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  'referer': 'https://app.cross-play.xyz/',
};

// Fungsi untuk delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi untuk membaca query_id dari file
async function readQueryId() {
  try {
    const data = await fs.readFile(QUERY_FILE, 'utf8');
    return data.trim();
  } catch (error) {
    console.error(chalk.red('❌ Gagal membaca query.txt:', error.message));
    throw error;
  }
}

// Fungsi untuk login dan mendapatkan access token
async function login(queryId) {
  const body = {
    encodedMessage: queryId,
  };

  try {
    const response = await axios.post(LOGIN_URL, body, { headers });
    const { accessToken } = response.data;
    console.log(chalk.green('✅ Login: True'));
    return accessToken;
  } catch (error) {
    console.error(chalk.red('❌ Login: False'));
    console.error(chalk.red('Error:', JSON.stringify(error.response?.data || error.message, null, 2)));
    throw error;
  }
}

// Fungsi untuk melakukan claim
async function claim(accessToken) {
  const claimHeaders = {
    ...headers,
    authorization: `Bearer ${accessToken}`,
  };

  try {
    await axios.post(CLAIM_URL, {}, { headers: claimHeaders });
    console.log(chalk.green('⛏️ Claim Mining: Done'));
  } catch (error) {
    console.error(chalk.red('❌ Claim Mining: Failed'));
    console.error(chalk.red('Error:', JSON.stringify(error.response?.data || error.message, null, 2)));
    throw error;
  }
}

// Fungsi untuk mendapatkan info karakter
async function getCharacterInfo(accessToken) {
  const infoHeaders = {
    ...headers,
    authorization: `Bearer ${accessToken}`,
  };

  try {
    const response = await axios.get(CHARACTER_INFO_URL, { headers: infoHeaders });
    const { currentLevel, goldAmount, gemAmount, autoMiningInfo } = response.data;
    console.log(chalk.blue('ℹ️ Information of your account'));
    console.log(chalk.cyan(`🎮 Level: ${currentLevel.value}`));
    console.log(chalk.cyan(`💰 Gold Balance: ${goldAmount}`));
    console.log(chalk.cyan(`💎 Gem Balance: ${gemAmount}`));
    console.log(chalk.cyan(`⏱️ Auto Mining Minutes: ${autoMiningInfo.autoMiningMinutes}`));
    console.log(chalk.cyan(`🚀 Increment per Second: ${autoMiningInfo.incrementPerSecond}`));
    return response.data;
  } catch (error) {
    console.error(chalk.red('❌ Gagal mendapatkan info karakter:'));
    console.error(chalk.red('Error:', JSON.stringify(error.response?.data || error.message, null, 2)));
    throw error;
  }
}

// Fungsi untuk menghitung delay random dalam milidetik
function getRandomDelay() {
  const minutes = Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
  return minutes * 60 * 1000; // Konversi ke milidetik
}

// Fungsi untuk menampilkan countdown
async function countdown(delay) {
  let remaining = delay;
  while (remaining > 0) {
    const minutes = Math.floor(remaining / 1000 / 60);
    const seconds = Math.floor((remaining / 1000) % 60);
    process.stdout.write(`\r${chalk.white(`⏳Waiting ${minutes} minute ${seconds} ...`)}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    remaining -= 1000;
  }
  process.stdout.write('\r' + ' '.repeat(60) + '\r'); // Bersihkan baris
}

// Fungsi utama
async function main() {
  console.log(chalk.blue(`🚀 Starting claim ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}...`));

  while (true) {
    try {
      // Baca query_id
      const queryId = await readQueryId();
      await delay(STEP_DELAY); // Jeda 2 detik setelah baca query
      
      // Login
      const accessToken = await login(queryId);
      await delay(STEP_DELAY); // Jeda 2 detik setelah login
      
      // Claim
      await claim(accessToken);
      await delay(STEP_DELAY); // Jeda 2 detik setelah claim
      
      // Dapatkan info karakter
      await getCharacterInfo(accessToken);
      
      // Hitung delay random dan jalankan countdown
      const delayTime = getRandomDelay();
      await countdown(delayTime);
    } catch (error) {
      console.error(chalk.red('⚠️ Terjadi kesalahan, mencoba lagi setelah 1 menit...'));
      await countdown(60 * 1000); // Countdown untuk 1 menit jika error
      await delay(STEP_DELAY); // Jeda 2 detik setelah error
    }
  }
}

// Jalankan script
main().catch(error => {
  console.error(chalk.red('💥 Error fatal:', error.message));
  process.exit(1);
});