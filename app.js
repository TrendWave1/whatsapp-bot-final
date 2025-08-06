const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { google } = require('googleapis');
const path = require('path');


// ==========================================================
// !!! КОНФИГУРАЦИЯ GOOGLE ТАБЛИЦ !!!
// ==========================================================
const SPREADSHEET_ID = '1uEKqcVhAf984QAoaKs5qX9KU4httBfAYiNYmkLYHdFY'; // <--- Вставьте сюда ID вашей Google Таблицы
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json'); // Путь к файлу с учетными данными
const RANGE = 'Лист1!A:E'; // Диапазон ячеек, куда будут записываться данные (например, Sheet1!A:E для 5 колонок)
// Убедитесь, что 'Лист1' - это название вашего листа в таблице!
// ==========================================================


let sheets; // Переменная для Google Sheets API


// ==========================================================
// = = = АУТЕНТИФИКАЦИЯ GOOGLE И ИНИЦИАЛИЗАЦИЯ SHEETS API = = =
// ==========================================================
async function authenticateGoogleSheets() {
   try {
       const auth = new google.auth.GoogleAuth({
           keyFile: CREDENTIALS_PATH,
           scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Доступ только к таблицам
       });


       const client = await auth.getClient();
       sheets = google.sheets({ version: 'v4', auth: client });
       console.log('Google Sheets API успешно аутентифицирован.');
   } catch (error) {
       console.error('Ошибка аутентификации Google Sheets API:', error);
       process.exit(1); // Завершаем процесс, если не можем подключиться к Google API
   }
}


// ==========================================================
// = = = СОХРАНЕНИЕ ДАННЫХ В GOOGLE ТАБЛИЦУ = = =
// ==========================================================
async function saveUserDataToSheet(userData) {
   const row = [
       userData.id,
       userData.name || '',
       userData.phone || '',
       userData.email || '', // Email теперь пустой
       new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' }) // Время в украинской локали
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
       // Продолжаем работу бота, но выводим ошибку
   }
}


// ==========================================================
// = = = ХРАНЕНИЕ СОСТОЯНИЙ ПОЛЬЗОВАТЕЛЕЙ = = =
// ==========================================================
const userStates = {}; // { 'chatId': { state: 'awaiting_name', name: '...', phone: '...' } }


// Инициализация клиента WhatsApp
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


// --- Обработка QR-кода ---
client.on('qr', qr => {
   qrcode.generate(qr, { small: true });
   console.log('Пожалуйста, отсканируйте QR-код в терминале с помощью WhatsApp на вашем телефоне.');
   console.log('WhatsApp -> Настройки (Settings) -> Связанные устройства (Linked Devices) -> Привязать устройство (Link a Device)');
});


// --- Когда клиент готов ---
client.on('ready', () => {
   console.log('Бот успешно подключен и готов к работе!');
});


// --- Обработка входящих сообщений ---
client.on('message', async msg => {
   const chatId = msg.from;
   const userMessage = msg.body.toLowerCase().trim();


   // Пропускаем медиасообщения
   if (msg.hasMedia) {
       return;
   }


   // Получаем текущее состояние пользователя или инициализируем
   if (!userStates[chatId]) {
       userStates[chatId] = { state: 'default' }; // Инициализируем состояние как 'default'
   }
   let currentUserData = userStates[chatId];




   switch (currentUserData.state) {
       case 'default':
           // При первом контакте или после завершения регистрации
           // Ждем, что пользователь напишет "старт" или "регистрация"
           if (userMessage === 'старт' || userMessage === 'регистрация' || userMessage === 'привет') {
               await msg.reply('Здравствуйте! Рад вас приветствовать. Давай начнем регистрацию. Как вас зовут?');
               currentUserData.state = 'awaiting_name';
           } else {
               await msg.reply('Привет! Я бот для регистрации. Чтобы начать, напишите "Старт" или "Регистрация".');
           }
           break;


       case 'awaiting_name':
           if (userMessage.length > 1 && userMessage.length < 50) { // Простая валидация длины имени
               currentUserData.name = msg.body;
               await msg.reply(`Отлично, ${currentUserData.name}! Теперь укажите ваш номер телефона в международном формате (например, +79xxxxxxxxxx).`);
               currentUserData.state = 'awaiting_phone';
           } else {
               await msg.reply('Пожалуйста, введите корректное имя. Оно должно быть не слишком коротким или длинным.');
           }
           break;


       case 'awaiting_phone':
           // Простая валидация номера телефона: начинается с '+' и состоит из 10-15 цифр
           if (userMessage.match(/^\+\d{10,15}$/)) {
               currentUserData.phone = msg.body;
              
               // Все данные собраны (Имя и Телефон), сохраняем в Google Таблицу
               await saveUserDataToSheet({
                   id: chatId,
                   name: currentUserData.name,
                   phone: currentUserData.phone,
                   email: '' // Email по-прежнему пустой
               });


               await msg.reply('Поздравляем с успешной регистрацией! Наш менеджер свяжется с Вами в ближайшее время!');
               currentUserData.state = 'registered'; // Меняем состояние на завершенное
           } else {
               await msg.reply('Пожалуйста, введите корректный номер телефона в международном формате (например, +79xxxxxxxxxx).');
           }
           break;


       case 'registered':
           // Если пользователь уже зарегистрирован
           await msg.reply('Вы уже оставили свои данные. Наш менеджер скоро свяжется с Вами. Если у вас есть вопросы, напишите "Помощь".');
           break;


       default:
           // Если пользователь каким-то образом оказался в состоянии, которое не обрабатывается
           userStates[chatId] = { state: 'default' }; // Сбрасываем состояние на 'default'
           await msg.reply('Извините, я не понял вашу команду. Пожалуйста, напишите "Старт" или "Регистрация", чтобы начать.');
           break;
   }
});


// Запускаем аутентификацию Google Sheets, затем клиента WhatsApp
authenticateGoogleSheets().then(() => {
   console.log('Google Sheets API готов. Запускаем клиент WhatsApp...');
   client.initialize();
}).catch(err => {
   console.error('Не удалось запустить бота из-за ошибки аутентификации Google Sheets:', err);
   process.exit(1);
});
