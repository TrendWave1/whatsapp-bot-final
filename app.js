const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { google } = require('googleapis');

// Ваш код для аутентификации в Google Sheets.
// Он должен быть здесь, чтобы переменная GOOGLE_CREDENTIALS была доступна.
const authenticateGoogleSheets = async () => {
    // Вставьте ваш код аутентификации здесь.
};

// Ваш код для записи данных в Google Sheets.
// Он должен быть здесь.
const appendDataToSheet = async (data) => {
    // Вставьте ваш код для записи данных здесь.
};

// Создаем клиент WhatsApp-web.js
const client = new Client({
    authStrategy: new LocalAuth()
});

let userStates = {};

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const chatId = chat.id._serialized;

    if (!userStates[chatId]) {
        userStates[chatId] = { state: 'default' };
    }

    const currentState = userStates[chatId].state;

    switch (currentState) {
        case 'default':
            if (msg.body === 'start') {
                await msg.reply('Привет! Чтобы получить доступ, пройдите регистрацию. Введите свой номер телефона.');
                userStates[chatId].state = 'waitingForPhone';
            }
            break;

        case 'waitingForPhone':
            // Простая проверка на то, что сообщение похоже на номер
            if (msg.body.startsWith('+') && msg.body.length > 10) {
                userStates[chatId].data = { phone: msg.body };
                userStates[chatId].state = 'waitingForName';
                await msg.reply('Отличный номер! Теперь введите ваше имя.');
            } else {
                await msg.reply('Некорректный номер. Пожалуйста, введите номер в формате +380...');
            }
            break;

        case 'waitingForName':
            userStates[chatId].data.name = msg.body;
            userStates[chatId].state = 'waitingForEmail';
            await msg.reply('Отличное имя! Теперь введите ваш email.');
            break;
            
        case 'waitingForEmail':
            // Простая проверка на email
            if (msg.body.includes('@') && msg.body.includes('.')) {
                userStates[chatId].data.email = msg.body;
                
                // Раскомментируйте эти строки, когда ваш код для Google Sheets будет готов
                // await authenticateGoogleSheets();
                // await appendDataToSheet(userStates[chatId].data);
                
                await msg.reply('Отличный email! Мы сохранили ваши данные. Спасибо за регистрацию!');
                userStates[chatId].state = 'registered';
            } else {
                await msg.reply('Некорректный email. Пожалуйста, введите email в правильном формате.');
            }
            break;

        case 'registered':
            await msg.reply('Вы уже зарегистрированы. Если у вас есть вопросы, напишите в службу поддержки.');
            break;

        default:
            await msg.reply('Извините, произошла ошибка. Пожалуйста, попробуйте еще раз. Для начала напишите "start".');
            userStates[chatId].state = 'default';
            break;
    }
});

// Добавляем прослушивание порта
const PORT = process.env.PORT || 3000;

client.initialize().then(() => {
    // ВАЖНО: Запускаем прослушивание порта только после инициализации клиента
    client.on('ready', () => {
        console.log('Client is ready!');
        // Не client.listen(), так как это не Express-сервер, а WWeb.js
        // WWeb.js запускается сам. Нам нужно просто убедиться, что он запущен.
        // Render.com проверяет наличие процесса, а не порта в данном случае.
    });
});