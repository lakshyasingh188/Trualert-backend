const express = require('express');
const cron = require('node-cron');
const twilio = require('twilio');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();



// ========================= SUPABASE =========================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);



// ========================= TWILIO =========================

const client = twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH_TOKEN
);



// ========================= FINNHUB =========================

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;



// ========================= GET LIVE PRICE =========================

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

    try {

        const { data, error } = await supabase
            .from('reminders')
            .select('*')
            .eq('called', false);

        if (error) {

            console.log(error);
            return;

        }

        if (!data || data.length === 0) {

            console.log("No Pending Reminders");
            return;

        }

        const now = new Date();

        for (const reminder of data) {

            const reminderTime =
                new Date(reminder.reminder_time);

            console.log("NOW:", now.toISOString());

            console.log(
                "REMINDER:",
                reminderTime.toISOString()
            );

            // DIFFERENCE IN SECONDS

            const diffSeconds = Math.floor(
                (now.getTime() -
                    reminderTime.getTime()) / 1000
            );

            console.log(
                "DIFF SECONDS:",
                diffSeconds
            );

            // ONLY CALL AFTER TIME
            // WITHIN 60 SECONDS

            if (
                diffSeconds >= 0 &&
                diffSeconds <= 60
            ) {

                try {

                    console.log(
                        "Calling:",
                        reminder.phone
                    );

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

</Response>
                        `,

                        to: reminder.phone,

                        from: '+15706528097'

                    });

                    await supabase
                        .from('reminders')
                        .update({ called: true })
                        .eq('id', reminder.id);

                    console.log(
                        "Reminder Call Success"
                    );

                } catch (e) {

                    console.log(
                        "Twilio Error"
                    );

                    console.log(e.message);

                }

            }

        }

    } catch (e) {

        console.log(
            "Reminder System Error"
        );

        console.log(e.message);

    }

});

// ========================= TRADER REMINDER =========================

cron.schedule('* * * * *', async () => {

    console.log("Checking Trader Reminders...");

    try {

        const { data, error } = await supabase
            .from('trader_reminders')
            .select('*')
            .eq('called', false);

        if (error) {

            console.log(
                "Trader Reminder Fetch Error"
            );

            console.log(error);

            return;
        }

        if (!data || data.length === 0) {

            console.log(
                "No Pending Trader Reminders"
            );

            return;
        }

        for (const item of data) {

            const livePrice =
                await getLivePrice(item.symbol);

            console.log(
                "Symbol:",
                item.symbol
            );

            console.log(
                "Live Price:",
                livePrice
            );

            console.log(
                "Target Price:",
                item.target_price
            );

            if (livePrice == null)
                continue;

            let shouldCall = false;

            // ABOVE TARGET

            if (

                item.direction === 'above' &&
                livePrice >= item.target_price

            ) {

                shouldCall = true;

            }

            // BELOW TARGET

            if (

                item.direction === 'below' &&
                livePrice <= item.target_price

            ) {

                shouldCall = true;

            }

            if (shouldCall) {

                try {

                    console.log(
                        "Trader Call:",
                        item.phone
                    );

                    await client.calls.create({

                        twiml: `
<Response>

<Say voice="alice">
${item.symbol} target price reached
</Say>

</Response>
                        `,

                        to: item.phone,

                        from: '+15706528097'

                    });

                    // MARK AS CALLED

                    await supabase
                        .from('trader_reminders')
                        .update({ called: true })
                        .eq('id', item.id);

                    console.log(
                        "Trader Reminder Call Success"
                    );

                } catch (e) {

                    console.log(
                        "Trader Reminder Twilio Error"
                    );

                    console.log(e.message);

                }

            }

        }

    } catch (e) {

        console.log(
            "Trader Reminder System Error"
        );

        console.log(e.message);

    }

});



// ========================= TEST API =========================

getLivePrice("OANDA:XAU_USD")
    .then(price => {

        console.log(
            "Gold Price:",
            price
        );

    });



// ========================= SERVER =========================

app.listen(3000, () => {

    console.log(
        "Server running on port 3000"
    );

});
