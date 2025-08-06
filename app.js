const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { google } = require('googleapis');

// ... (остальной код для Google Sheets)

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
            // Проверка номера телефона
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
            userStates[chatId].data.email = msg.body;
            // Здесь ваш код для сохранения в Google Sheets
            // await appendDataToSheet(currentUserData);
            await msg.reply('Отличный email! Мы сохранили ваши данные. Спасибо за регистрацию!');
            userStates[chatId].state = 'registered';
            break;

        case 'registered':
            await msg.reply('Вы уже зарегистрированы. Если у вас есть вопросы, напишите в службу поддержки.');
            break;

        default:
            await msg.reply('Извините, произошла ошибка. Пожалуйста, попробуйте еще раз. Для начала напишите "start"');
            userStates[chatId].state = 'default';
            break;
    }
});

client.initialize();
