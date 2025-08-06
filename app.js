const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { google } = require('googleapis');
const path = require('path');

// ==========================================================
// !!! КОНФИГУРАЦИЯ GOOGLE ТАБЛИЦ !!!
// ==========================================================
const SPREADSHEET_ID = '1uEKqcVhAf984QAoaKs5qX9KU4httBfAYiNYmkLYHdFY'; // <--- Вставьте сюда ID вашей Google Таблицы
let googleCredentials;
if (process.env.GOOGLE_CREDENTIALS) {
    try {
        googleCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        console.log('Google credentials loaded from environment variable.');
    } catch (e) {
        console.error('Error parsing GOOGLE_CREDENTIALS environment variable:', e);
        process.exit(1);
    }
} else {
    // Fallback для локального запуска
    const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
    googleCredentials = require(CREDENTIALS_PATH);
    console.log('Google credentials loaded from local file.');
}
const RANGE = 'Лист1!A:E'; // Диапазон ячеек, куда будут записываться данные
// ==========================================================

let sheets;

async function authenticateGoogleSheets() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: googleCredentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        sheets = google.sheets({ version: 'v4', auth: client });
        console.log('Google Sheets API успешно аутентифицирован.');
    } catch (error) {
        console.error('Ошибка аутентификации Google Sheets API:', error);
        process.exit(1);
    }
}

async function saveUserDataToSheet(userData) {
    const row = [
        userData.id,
        userData.name || '',
        userData.phone || '',
        userData.email || '',
        new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })
    ];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [row],
            },
        });
        console.log('Данные успешно сохранены в Google Таблицу.');
    } catch (error) {
        console.error('Ошибка при сохранении данных в Google Таблицу:', error);
    }
}

const userStates = {};

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage'
        ],
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Пожалуйста, отсканируйте QR-код в терминале с помощью WhatsApp на вашем телефоне.');
    console.log('WhatsApp -> Настройки -> Связанные устройства -> Привязать устройство');
});

client.on('ready', () => {
    console.log('Бот успешно подключен и готов к работе!');
});

client.on('message', async msg => {
    const chatId = msg.from;
    const userMessage = msg.body.trim();

    if (msg.hasMedia) {
        return;
    }

    if (!userStates[chatId]) {
        userStates[chatId] = { state: 'default' };
    }
    
    let currentUserData = userStates[chatId];
    
    switch (currentUserData.state) {
        case 'default':
            await msg.reply('Здравствуйте! Рады Вас приветствовать. Давайте начнем регистрацию. Как Вас зовут?');
            currentUserData.state = 'awaiting_name';
            return; // <-- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
            // Теперь бот гарантированно остановит выполнение функции
            // и будет ждать нового сообщения.

        case 'awaiting_name':
            currentUserData.name = msg.body;
            await msg.reply(`Отлично, ${currentUserData.name}! Теперь укажите Ваш номер телефона в международном формате (например, +44xxxxxxxxxx).`);
            currentUserData.state = 'awaiting_phone';
            return; // <-- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
            // После этого `return` бот прекратит выполнение функции
            // и будет ждать нового сообщения.

        case 'awaiting_phone':
            if (userMessage.match(/^\+\d{10,15}$/)) {
                currentUserData.phone = msg.body;
                
                await saveUserDataToSheet({
                    id: chatId,
                    name: currentUserData.name,
                    phone: currentUserData.phone,
                    email: ''
                });

                await msg.reply('Поздравляем с успешной регистрацией! Наш менеджер свяжется с Вами в ближайшее время!');
                currentUserData.state = 'registered';
            } else {
                await msg.reply('Некорректный номер. Пожалуйста, укажите его в международном формате, например, +44xxxxxxxxxx.');
            }
            break;

        case 'registered':
            await msg.reply('Вы уже оставили свои данные. Наш менеджер скоро свяжется с Вами.');
            break;

        default:
            userStates[chatId] = { state: 'default' };
            await msg.reply('Извините, произошла ошибка. Пожалуйста, попробуйте начать сначала.');
            break;
    }
});

authenticateGoogleSheets().then(() => {
    console.log('Google Sheets API готов. Запускаем клиент WhatsApp...');
    client.initialize();
}).catch(err => {
    console.error('Не удалось запустить бота из-за ошибки аутентификации Google Sheets:', err);
    process.exit(1);
});
