const express = require('express');
const cron = require('node-cron');
const twilio = require('twilio');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();



// ================= SUPABASE =================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);



// ================= TWILIO =================

const client = twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH_TOKEN
);



// ================= FINNHUB =================

const FINNHUB_API_KEY =
    process.env.FINNHUB_API_KEY;



// ================= LIVE PRICE =================

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



// ================= MAKE CALL =================

async function makeCall(phone, message) {

    try {

        await client.calls.create({

            twiml: `
<Response>

<Say voice="alice">
${message}
</Say>

<Pause length="1"/>

<Say voice="alice">
${message}
</Say>

<Pause length="1"/>

<Say voice="alice">
${message}
</Say>

</Response>
            `,

            to: phone,

            from: process.env.TWILIO_PHONE

        });

        return true;

    } catch (e) {

        console.log("Twilio Call Error");
        console.log(e.message);

        return false;
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

            console.log(error.message);
            return;
        }

        const now = new Date();

        for (const reminder of data) {

            try {

                const reminderTime =
                    new Date(reminder.reminder_time);

                // DIFFERENCE IN MILLISECONDS

                const diff =
                    Math.abs(
                        now.getTime() -
                        reminderTime.getTime()
                    );

                // 1 MINUTE WINDOW

                const oneMinute =
                    60 * 1000;

                console.log(
                    "Reminder ID:",
                    reminder.id
                );

                console.log(
                    "Now:",
                    now.toISOString()
                );

                console.log(
                    "Reminder:",
                    reminderTime.toISOString()
                );

                console.log(
                    "Diff:",
                    diff
                );

                if (diff <= oneMinute) {

                    console.log(
                        "Calling User:",
                        reminder.phone
                    );

                    const success =
                        await makeCall(
                            reminder.phone,
                            reminder.message
                        );

                    if (success) {

                        await supabase
                            .from('reminders')
                            .update({
                                called: true
                            })
                            .eq('id', reminder.id);

                        console.log(
                            "Reminder Call Success"
                        );

                    }

                }

            } catch (e) {

                console.log(
                    "Single Reminder Error"
                );

                console.log(e.message);

            }

        }

    } catch (e) {

        console.log(
            "Normal Reminder Error"
        );

        console.log(e.message);

    }

});



// ================= TRADER REMINDER =================

cron.schedule('* * * * *', async () => {

    console.log(
        "Checking Trader Reminders..."
    );

    try {

        const { data, error } = await supabase
            .from('trader_reminders')
            .select('*')
            .eq('called', false);

        if (error) {

            console.log(error.message);
            return;
        }

        for (const item of data) {

            try {

                const livePrice =
                    await getLivePrice(
                        item.symbol
                    );

                console.log(
                    "Symbol:",
                    item.symbol
                );

                console.log(
                    "Live Price:",
                    livePrice
                );

                console.log(
                    "Target:",
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

                    console.log(
                        "Trader Calling:",
                        item.phone
                    );

                    const success =
                        await makeCall(
                            item.phone,
                            `${item.symbol} target price reached`
                        );

                    if (success) {

                        await supabase
                            .from('trader_reminders')
                            .update({
                                called: true
                            })
                            .eq('id', item.id);

                        console.log(
                            "Trader Call Success"
                        );

                    }

                }

            } catch (e) {

                console.log(
                    "Single Trader Error"
                );

                console.log(e.message);

            }

        }

    } catch (e) {

        console.log(
            "Trader Reminder Error"
        );

        console.log(e.message);

    }

});



// ================= TEST =================

getLivePrice("OANDA:XAU_USD")
    .then(price => {

        console.log(
            "Gold Price:",
            price
        );

    });



// ================= SERVER =================

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});
