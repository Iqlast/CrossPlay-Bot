const axios = require('axios');
const fs = require('fs').promises;
const chalk = require('chalk');


const MIN_MINUTES = 5; 
const MAX_MINUTES = 15; 
const QUERY_FILE = 'query.txt'; 
const LOGIN_URL = 'https://api.cross-play.xyz/users/login';
const CLAIM_URL = 'https://api.cross-play.xyz/users/golds/claim';
const CHARACTER_INFO_URL = 'https://api.cross-play.xyz/characters/character-info';
const STEP_DELAY = 2000; 


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


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


async function readQueryId() {
  try {
    const data = await fs.readFile(QUERY_FILE, 'utf8');
    return data.trim();
  } catch (error) {
    console.error(chalk.red('❌ Gagal membaca query.txt:', error.message));
    throw error;
  }
}


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


function getRandomDelay() {
  const minutes = Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
  return minutes * 60 * 1000; 
}


async function countdown(delay) {
  let remaining = delay;
  while (remaining > 0) {
    const minutes = Math.floor(remaining / 1000 / 60);
    const seconds = Math.floor((remaining / 1000) % 60);
    process.stdout.write(`\r${chalk.white(`⏳Waiting ${minutes} minute ${seconds} ...`)}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    remaining -= 1000;
  }
  process.stdout.write('\r' + ' '.repeat(60) + '\r'); 
}


async function main() {
  console.log(chalk.blue(`🚀 Starting claim ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}...`));

  while (true) {
    try {
   
      const queryId = await readQueryId();
      await delay(STEP_DELAY); 
      

      const accessToken = await login(queryId);
      await delay(STEP_DELAY); 
      
     
      await claim(accessToken);
      await delay(STEP_DELAY); 
      
     
      await getCharacterInfo(accessToken);
      
      
      const delayTime = getRandomDelay();
      await countdown(delayTime);
    } catch (error) {
      console.error(chalk.red('⚠️ Terjadi kesalahan, mencoba lagi setelah 1 menit...'));
      await countdown(60 * 1000); 
      await delay(STEP_DELAY); 
    }
  }
}

// Jalankan script
main().catch(error => {
  console.error(chalk.red('💥 Error fatal:', error.message));
  process.exit(1);
});
