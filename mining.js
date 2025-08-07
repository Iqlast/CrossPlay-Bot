const axios = require('axios');
const fs = require('fs').promises;
const chalk = require('chalk');

// Konfigurasi
const MIN_MINUTES = 5; // Minimal menit untuk delay random
const MAX_MINUTES = 10; // Maksimal menit untuk delay random
const QUERY_FILE = 'q.txt'; // File query_id
const LOGIN_URL = 'https://api.cross-play.xyz/users/login';
const CLAIM_URL = 'https://api.cross-play.xyz/users/golds/claim';
const CHARACTER_INFO_URL = 'https://api.cross-play.xyz/characters/character-info';
const DAILY_ITEM_BOX_URL = 'https://api.cross-play.xyz/shops/daily-item-box';
const DAILY_ITEM_BOX_RECEIVE_URL = 'https://api.cross-play.xyz/shops/daily-item-box/receive';
const UNOPENED_ITEM_BOXES_URL = 'https://api.cross-play.xyz/item-boxes/unopened';
const OPEN_ITEM_BOXES_URL = 'https://api.cross-play.xyz/item-boxes';
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
    console.error(chalk.red(`❌ Gagal membaca ${QUERY_FILE}:`, error.message));
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
    if (error.response?.status === 401) {
      throw new Error('Unauthorized: Stopping script due to invalid login credentials');
    }
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

// Fungsi untuk memeriksa daily item box
async function checkDailyItemBox(accessToken) {
  const dailyHeaders = {
    ...headers,
    authorization: `Bearer ${accessToken}`,
  };

  try {
    const response = await axios.get(DAILY_ITEM_BOX_URL, { headers: dailyHeaders });
    const { bool } = response.data;
    console.log(chalk.green(`📦 Daily Item Box Check: ${bool}`));
    return bool;
  } catch (error) {
    console.error(chalk.red('❌ Gagal memeriksa Daily Item Box:'));
    console.error(chalk.red('Error:', JSON.stringify(error.response?.data || error.message, null, 2)));
    throw error;
  }
}

// Fungsi untuk menerima daily item box
async function receiveDailyItemBox(accessToken) {
  const dailyHeaders = {
    ...headers,
    authorization: `Bearer ${accessToken}`,
  };

  try {
    await axios.post(DAILY_ITEM_BOX_RECEIVE_URL, {}, { headers: dailyHeaders });
    console.log(chalk.green('🎁 Daily Item Box Received: Done'));
  } catch (error) {
    console.error(chalk.red('❌ Gagal menerima Daily Item Box:'));
    console.error(chalk.red('Error:', JSON.stringify(error.response?.data || error.message, null, 2)));
    throw error;
  }
}

// Fungsi untuk mendapatkan daftar unopened item boxes
async function getUnopenedItemBoxes(accessToken) {
  const boxHeaders = {
    ...headers,
    authorization: `Bearer ${accessToken}`,
  };

  try {
    const response = await axios.get(UNOPENED_ITEM_BOXES_URL, { headers: boxHeaders });
    console.log(chalk.green(`📋 Unopened Item Boxes: ${response.data.length} found`));
    return response.data;
  } catch (error) {
    console.error(chalk.red('❌ Gagal mendapatkan Unopened Item Boxes:'));
    console.error(chalk.red('Error:', JSON.stringify(error.response?.data || error.message, null, 2)));
    throw error;
  }
}

// Fungsi untuk membuka item boxes
async function openItemBoxes(accessToken, boxes) {
  const boxHeaders = {
    ...headers,
    authorization: `Bearer ${accessToken}`,
  };

  try {
    for (const box of boxes) {
      await axios.post(OPEN_ITEM_BOXES_URL, { id: box.id }, { headers: boxHeaders });
      console.log(chalk.green(`🎉 Opened Item Box ID: ${box.id}`));
      await delay(STEP_DELAY); // Jeda antar pembukaan box
    }
  } catch (error) {
    console.error(chalk.red('❌ Gagal membuka Item Box:'));
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
    process.stdout.write(`\r${chalk.white(`⏳ Waiting ${minutes} minute ${seconds} ...`)}`);
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
      
      // Cek daily item box
      const dailyBoxAvailable = await checkDailyItemBox(accessToken);
      await delay(STEP_DELAY); // Jeda 2 detik setelah cek daily box
      
      // Jika daily box tersedia, lakukan receive
      if (dailyBoxAvailable) {
        await receiveDailyItemBox(accessToken);
        await delay(STEP_DELAY); // Jeda 2 detik setelah receive
      }
      
      // Cek unopened item boxes
      const unopenedBoxes = await getUnopenedItemBoxes(accessToken);
      await delay(STEP_DELAY); // Jeda 2 detik setelah cek unopened boxes
      
      // Jika ada unopened boxes, lakukan open
      if (unopenedBoxes.length > 0) {
        await openItemBoxes(accessToken, unopenedBoxes);
        await delay(STEP_DELAY); // Jeda 2 detik setelah open boxes
      }
      
      // Dapatkan info karakter
      await getCharacterInfo(accessToken);
      
      // Hitung delay random dan jalankan countdown
      const delayTime = getRandomDelay();
      await countdown(delayTime);
    } catch (error) {
      // Jika error adalah Unauthorized, hentikan script
      if (error.message.includes('Unauthorized')) {
        console.error(chalk.red('💥 Fatal Error:', error.message));
        process.exit(1);
      }
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
