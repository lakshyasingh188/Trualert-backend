const express = require('express');
const cron = require('node-cron');
const twilio = require('twilio');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
require('dotenv').config();


// ================= SUPABASE =================

const supabase = createClient(
    'SUPABASE_URL',
    'SUPABASE_KEY'
);



// ================= TWILIO =================

const client = twilio(
    'TWILIO_SID',
    'TWILIO_AUTH_TOKEN'
);



// ================= FINNHUB =================

const FINNHUB_API_KEY =
    'FINNHUB_API_KEY';



// ================= GET LIVE PRICE =================

async function getLivePrice(symbol) {

    try {

        const response = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
        );

        return response.data.c;

    } catch (e) {

        console.log("Price API Error");
        console.log(e.message);

        return null;

    }

}



// ================= NORMAL REMINDER =================

cron.schedule('* * * * *', async () => {

    console.log("Checking Normal Reminders...");

    const now = new Date();

    const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('called', false);

    if (error) {

        console.log(error);
        return;

    }

    for (const reminder of data) {

        const reminderTime = new Date(reminder.reminder_time);

        const diff = Math.abs(now - reminderTime);

        if (diff < 60000) {

            try {

                console.log("Calling:", reminder.phone);

                await client.calls.create({

                    twiml: `
<Response>
<Say voice="alice">
${reminder.message}
</Say>

<Pause length="1"/>

<Say voice="alice">
${reminder.message}
</Say>

<Pause length="1"/>

<Say voice="alice">
${reminder.message}
</Say>
</Response>
`,

                    to: reminder.phone,

                    from: '+15706528097'

                });

                await supabase
                    .from('reminders')
                    .update({ called: true })
                    .eq('id', reminder.id);

                console.log("Reminder Call Success");

            } catch (e) {

                console.log("Twilio Error");
                console.log(e.message);

            }

        }

    }

});



// ================= TRADER REMINDER =================

cron.schedule('* * * * *', async () => {

    console.log("Checking Trader Reminders...");

    const { data, error } = await supabase
        .from('trader_reminders')
        .select('*')
        .eq('called', false);

    if (error) {

        console.log(error);
        return;

    }

    for (const item of data) {

        const livePrice = await getLivePrice(item.symbol);

        console.log("Symbol:", item.symbol);
        console.log("Live Price:", livePrice);
        console.log("Target:", item.target_price);

        if (livePrice == null) continue;

        let shouldCall = false;

        if (
            item.direction === 'above' &&
            livePrice >= item.target_price
        ) {

            shouldCall = true;

        }

        if (
            item.direction === 'below' &&
            livePrice <= item.target_price
        ) {

            shouldCall = true;

        }

        if (shouldCall) {

            try {

                console.log("Trader Call:", item.phone);

                await client.calls.create({

                    twiml:
                        `<Response><Say>${item.symbol} target price reached.</Say></Response>`,

                    to: item.phone,

                    from: '+15706528097'

                });

                await supabase
                    .from('trader_reminders')
                    .update({ called: true })
                    .eq('id', item.id);

                console.log("Trader Call Success");

            } catch (e) {

                console.log("Trader Twilio Error");
                console.log(e.message);

            }

        }

    }

});



// ================= TEST PRICE =================

getLivePrice("OANDA:XAU_USD")
    .then(price => {

        console.log("Gold Price:", price);

    });



// ================= SERVER =================

app.listen(3000, () => {

    console.log("Server running on port 3000");

});
