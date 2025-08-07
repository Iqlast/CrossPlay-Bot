const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

const SESSION_FILE_PATH = './telegram_session.json';
const USER_DATA_DIR = './user_data'; // Persistent user data directory

async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(cookies, null, 2));
  console.log('[INFO] Session cookies saved successfully.');
}

async function loadCookies(page) {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE_PATH));
    await page.setCookie(...cookies);
    console.log('[INFO] Session cookies loaded successfully.');
    return true;
  }
  return false;
}

function promptInput(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickButtonWithRetry(page, selector, buttonText, maxRetries = 5, retryDelay = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: 20000 });
      const buttons = await page.$$(selector);
      for (const button of buttons) {
        const text = await page.evaluate(el => el.innerText.toLowerCase(), button);
        if (text.includes(buttonText.toLowerCase())) {
          const isDisabled = await page.evaluate(el => el.disabled, button);
          if (isDisabled) {
            console.log(`[INFO] Attempt ${attempt}: Button "${buttonText}" is disabled, retrying...`);
            await delay(retryDelay);
            continue;
          }
          await button.click();
          return true;
        }
      }
      console.log(`[INFO] Attempt ${attempt}: Button with text "${buttonText}" not found, retrying...`);
      await delay(retryDelay);
    } catch (error) {
      console.log(`[INFO] Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        console.error(`[ERROR] Failed to click "${buttonText}" button after ${maxRetries} attempts`);
        return false;
      }
      await delay(retryDelay);
    }
  }
  return false;
}

async function typeInputWithRetry(page, selector, value, maxRetries = 3, retryDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: 20000 });
      const input = await page.$(selector);
      if (input) {
        await input.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await input.type(value, { delay: 100 });
        const enteredValue = await page.evaluate(el => el.value, input);
        if (enteredValue === value) {
          return true;
        }
        console.log(`[INFO] Attempt ${attempt}: Input value "${enteredValue}" does not match expected "${value}", retrying...`);
      } else {
        console.log(`[INFO] Attempt ${attempt}: Input field not found, retrying...`);
      }
      await delay(retryDelay);
    } catch (error) {
      console.log(`[INFO] Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        console.error(`[ERROR] Failed to type into input field after ${maxRetries} attempts`);
        return false;
      }
      await delay(retryDelay);
    }
  }
  return false;
}

(async () => {
  // Clear q.txt if it exists
  if (fs.existsSync('q.txt')) {
    fs.unlinkSync('q.txt');
    console.log('[INFO] Cleared existing q.txt file.');
  }

  // Launch browser in headless mode
  const browser = await puppeteer.launch({
    headless: true, // Run in headless mode (no GUI)
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
    userDataDir: USER_DATA_DIR // Persist browser data
  });
  const page = await browser.newPage();

  // Set up request interception to capture the login query
  await page.setRequestInterception(true);
  let capturedQuery = null;

  page.on('request', request => {
    if (request.url() === 'https://api.cross-play.xyz/users/login') {
      const postData = request.postData();
      if (postData) {
        try {
          const jsonData = JSON.parse(postData);
          capturedQuery = jsonData.encodedMessage;
          console.log('[INFO] Captured query from login request:', capturedQuery);
          fs.writeFileSync('q.txt', capturedQuery);
          console.log('[INFO] Encoded message saved to q.txt');
          // Stop script after saving to q.txt
          browser.close();
          process.exit(0);
        } catch (error) {
          console.error('[ERROR] Failed to parse or save query:', error.message);
        }
      }
    }
    request.continue();
  });

  // Load existing session cookies if available
  const hasSession = await loadCookies(page);

  // Navigate directly to the Cross Play bot
  console.log('[INFO] Navigating to Cross Play bot...');
  await page.goto('https://web.telegram.org/a/#7452502511', { waitUntil: 'networkidle2' });

  if (!hasSession) {
    console.log('[INFO] No existing session found. Starting new login process...');
    
    try {
      console.log('[INFO] Waiting for Telegram interface to load...');
      await delay(5000);

      console.log('[INFO] Clicking "Log in by phone Number"...');
      const loginButtonSelector = 'button.Button.smaller.primary.text';
      const loginClicked = await clickButtonWithRetry(page, loginButtonSelector, 'log in by phone number');
      if (!loginClicked) {
        console.error('[ERROR] Failed to click Log in by phone Number button');
        await browser.close();
        return;
      }
      console.log('[INFO] Log in by phone Number button clicked successfully!');

      await delay(2000);

      const phone = await promptInput('Enter phone number (without +62, e.g., 85794409934): ');
      console.log('[INFO] Phone number provided:', phone);

      await page.waitForSelector('input#sign-in-phone-number', { timeout: 30000 });
      const phoneInput = await page.$('input#sign-in-phone-number');
      if (phoneInput) {
        await phoneInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await phoneInput.type(phone, { delay: 100 });
        console.log(`[INFO] Phone number entered: ${phone}`);
      } else {
        throw new Error('Phone number input field not found!');
      }

      console.log('[INFO] Waiting for Next button to load...');
      await delay(5000);

      console.log('[INFO] Attempting to click Next button...');
      const nextButtonSelector = 'button.Button.smaller.primary.has-ripple';
      const nextClicked = await clickButtonWithRetry(page, nextButtonSelector, 'next');
      if (!nextClicked) {
        console.error('[ERROR] Failed to click Next button');
        await browser.close();
        return;
      }
      console.log('[INFO] Next button clicked successfully!');

      console.log('[INFO] Waiting for OTP code to be sent to your Telegram...');
      const code = await promptInput('Enter OTP code: ');

      console.log('[INFO] Waiting for OTP input field to load...');
      await delay(3000);

      const otpInputSelector = 'input#sign-in-code';
      const otpEntered = await typeInputWithRetry(page, otpInputSelector, code);
      if (!otpEntered) {
        throw new Error('Failed to enter OTP code!');
      }
      console.log('[INFO] OTP code entered. Waiting for login to complete...');

      try {
        await page.waitForSelector('.chatlist', { timeout: 15000 });
        console.log('[INFO] Login successful! Main interface detected.');
      } catch (e) {
        console.log('[INFO] Alternative check for login success...');
        await page.waitForFunction(() => {
          return document.querySelector('body').innerText.includes('Chats') || 
                 document.querySelector('body').innerText.includes('Saved Messages');
        }, { timeout: 15000 });
      }

      await saveCookies(page);
      console.log('[INFO] Session saved successfully. You won\'t need to login next time.');
      
    } catch (error) {
      console.error(`[ERROR] Login failed: ${error.message}`);
      await browser.close();
      return;
    }
  } else {
    console.log('[INFO] Logged in automatically using saved session.');
  }

  // Interact with the Cross Play bot
  try {
    console.log('[INFO] Waiting for bot interface to load...');
    await delay(5000);

    await page.evaluate(() => window.scrollBy(0, 200));

    console.log('[INFO] Attempting to click Play button...');
    const playButtonSelector = 'button.Button.composer-action-button.bot-menu.open.default.translucent.round';
    const playClicked = await clickButtonWithRetry(page, playButtonSelector, 'play');
    if (!playClicked) {
      console.error('[ERROR] Failed to click Play button');
      await browser.close();
      return;
    }
    console.log('[INFO] Play button clicked successfully!');

    // Wait 3 seconds after clicking Play
    console.log('[INFO] Waiting 3 seconds after clicking Play...');
    await delay(3000);

    console.log('[INFO] Waiting for Confirm button...');
    await delay(3000);

    const confirmButtonSelector = 'button.Button.confirm-dialog-button.default.primary.text';
    const confirmClicked = await clickButtonWithRetry(page, confirmButtonSelector, 'confirm');
    if (!confirmClicked) {
      console.error('[ERROR] Failed to click Confirm button');
      await browser.close();
      return;
    }
    console.log('[INFO] Confirm button clicked successfully!');

    console.log('[INFO] Waiting for login query to be captured...');
    await page.waitForRequest(
      request => request.url() === 'https://api.cross-play.xyz/users/login',
      { timeout: 60000 }
    ).catch(e => {
      console.error('[ERROR] Failed to capture login request:', e.message);
    });

  } catch (error) {
    console.error(`[ERROR] Failed to interact with bot: ${error.message}`);
    await browser.close();
  }
})();