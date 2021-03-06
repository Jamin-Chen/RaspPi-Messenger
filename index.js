var express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request');
var app = express();

var userState = {}; // stores the user state for each user by ID

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 3000));

app.get('/', function (request, response) {
    // boot boot
    response.send('This is the Raspberry Pi Messenger Bot.');
});

app.get('/webhook', function (request, response) {
    // verification function
    if (request.query['hub.verify_token'] === 'testbot_verify_token') {
        response.send(request.query['hub.challenge']);
    } else {
        response.send('Invalid verify token');
    }
});

// handler receiving messages
app.post('/webhook', function (req, res) {
    var events = req.body.entry[0].messaging;
    for (i = 0; i < events.length; i++) {
        let event = events[i];
        let sender = event.sender.id;
        if (event.message && event.message.text) {
            // handle TEXT messages
            let text = event.message.text;
            switch (text) {
                case "reset":
                    userState[sender] = 0;
                    break;
            }
            if (typeof(userState[sender]) === 'undefined') {
                sendTextMessage(sender, "Hello, nice to meet you!");
                sendDefaultMessage(sender);
            }
            switch (userState[sender]) {
                case 1.1:
                    var messageText = text;
                    sendTextMessage(sender, "To confirm, is this your message?");
                    sendTextConfirm(sender, messageText);
                    break;
                case 0:
                    sendDefaultMessage(sender);
                    break;
                default:
                    sendTextMessage(sender, "Whoops, I didn't quite understand that. Let me reset myself real quick!");
                    userState[sender] = 0;
            }
        } else if (event.message && event.message.attachments[0].payload.coordinates) {
            // handle LOCATION messages
            console.log("location receieved");
            switch (userState[sender]) {
                case 2.1:
                    lat = event.message.attachments[0].payload.coordinates.lat;
                    lng = event.message.attachments[0].payload.coordinates.long;
                    console.log(lat);
                    console.log(lng);
                    if (lat && lng) {
                        sendTextMessage(sender, "Great, I'll change it now!");
                    }
                    userState[sender] = 0;
                    break;
            }
        } else if (event.postback) {
            payload = JSON.stringify(event.postback.payload);
            payload = payload.trim();
            payload = payload.slice(1, -1);
            switch (payload) {
                case "Send Message":
                    console.log("payload");
                    sendTextMessage(sender, "What message would you like to send?");
                    userState[sender] = 1.1;
                    break;
                case "Change Location":
                    userState[sender] = 2.1;
                    promptLocation(sender);
                    break;
                case "Yes 1.1":
                    sendTextMessage(sender, "Great, I'll send it now!");
                    userState[sender] = 0;
                    break;
                case "No 1.1":
                    sendTextMessage(sender, "Whoops, let's try again! What message would you like to send?");
                    userState[sender] = 1.1;
                    break;
                default:
                    sendTextMessage(sender, "Unidentified payload. Whoops! Resetting...");
                    userState[sender] = 0;
            }
        }
    }
    res.sendStatus(200);
});

// generic function sending messages
function sendMessage(recipientId, message) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
};

function sendTextMessage(recipientId, text) {
    sendMessage(recipientId, {text:text});
};

function sendDefaultMessage(recipientId) {
    // Send the welcome message
    sendMessage(recipientId, {
        "attachment":{
              "type":"template",
              "payload":{
                "template_type":"button",
                "text":"What do you want to do?",
                "buttons":[
                  {
                    "type":"postback",
                    "title":"Send a message",
                    "payload":"Send Message"
                  },
                  {
                    "type":"postback",
                    "title":"Change location",
                    "payload":"Change Location"
                  }
                ]
              }
          }
        });
};

function sendTextConfirm(recipientId, messageText) {
    // Send structured confirm message with "Yes" and "No" options to allow
    // user to confirm that the proper message is being sent.
    sendMessage(recipientId, {
        "attachment":{
              "type":"template",
              "payload":{
                "template_type":"button",
                "text": messageText,
                "buttons":[
                  {
                    "type":"postback",
                    "title":"Yes",
                    "payload":"Yes 1.1"
                  },
                  {
                    "type":"postback",
                    "title":"No",
                    "payload":"No 1.1"
                  }
                ]
              }
          }
        });
};

function promptLocation(recipientId) {
    sendMessage(recipientId, {
        "text":"Where would you like to set the new location?",
        "quick_replies":[
          {
            "content_type":"location",
          }
        ]
    });
};
