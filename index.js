/**
 * Copyright 2017-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 * Starter Project for Messenger Platform Quick Start Tutorial
 *
 * Use this project as the starting point for following the 
 * Messenger Platform quick start tutorial.
 *
 * https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/
 *
 */

'use strict';

// Imports dependencies and set up http server
const
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  twilio = require('twilio'),
  app = express().use(body_parser.json()); // creates express http server

const PAGE_ACCESS_TOKEN = "EAAN7phZBi1OoBAMQF4jMzj0WwmrqtFoz9ZBNTnEk0GOPB647FBc5QNA8ucCOfO80s4oyHR1IQPCuBY3cBzh9H05gWbrZB14XhF3M0LsKHzukQ314ullHfa0R8WtvGcxgWajTMS0TTQiSEpQbk1fZBp6BQLDJb2uJie8ZA1w6D9EowEw6CW7sX";

//HERE credentials
const hereID = 'uCKWIpdAPOobg4i3fSLx';
const hereCode = 'SqyhK_kzHrsB6cG4XM0k2A';

//Twilio credentials:
const twilioSid = 'ACed35559d3f3757a3e17e17e0a82df334';
const twilioToken = 'af7f4d73a0165f59dff43a4ac3a2d1c4';

const client = new twilio(twilioSid, twilioToken);
const MessagingResponse = twilio.twiml.MessagingResponse;

var places = [];

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {

      // Get the webhook event. entry.messaging is an array, but 
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {

  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "test";

  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {

    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

function handleMessage(sender_psid, received_message) {

  let response;

  // Check if the message contains text
  if (received_message.text) {

    var incoming = received_message.text;
    if (incoming.length > 1) {
      if (!incoming.includes('near')) {

        response = {
          "text": `Please enter in the format 'place_name near address'`
        }
        console.log(incoming);
        // Sends the response message
        callSendAPI(sender_psid, response);
        return;
      }
      var searchQuery = incoming.split(' near ')[0];
      var locationQuery = incoming.split(' near ')[1];

      var geocodeURL = `https://geocoder.cit.api.here.com/6.2/geocode.json?app_id=${hereID}&app_code=${hereCode}&searchtext=${locationQuery}`;

      request(geocodeURL, (error, response, body) => {
        let geocodeJson = JSON.parse(body);
        if (geocodeJson.Response.View[0] == null) {
          response = {
            "text": `No such place can be found on the map`
          }
          // Sends the response message
          callSendAPI(sender_psid, response);
          return;
        }

        var coordinates = {
          lat: geocodeJson.Response.View[0].Result[0].Location.DisplayPosition.Latitude,
          long: geocodeJson.Response.View[0].Result[0].Location.DisplayPosition.Longitude
        };

        var placesURL = `https://places.cit.api.here.com/places/v1/autosuggest?at=${coordinates.lat},${coordinates.long}` +
          '&q=' + searchQuery.replace(/ /g, '+') +
          '&app_id=' + hereID +
          '&tf=plain' +
          '&app_code=' + hereCode;


        request.get(placesURL, (error, response, body) => {
          let placesJson = JSON.parse(body);
          var placeResults = placesJson.results;

          var resultAmount = Math.min(3, placeResults.length)
          //var resultAmount = 3;

          var responseMessage = `Here are ${resultAmount} closet ${searchQuery} places for you\n`;
          var i;
          for (i = 0; i < resultAmount; i++) {
            if (placeResults[i].resultType != 'category') {
              places.push({
                name: placeResults[i].title,
                category: placeResults[i].category,
                address: placeResults[i].vicinity
              });
              //console.log(placeResults[i].vincinity);
              responseMessage += `(${places.length}) ${placeResults[i].title}\n`
            } else {
              resultAmount++;
            }
          }
          response = {
            "text": responseMessage
          }
          console.log(placeResults.length);
          console.log(searchQuery);
          // Sends the response message
          callSendAPI(sender_psid, response);
        });
      });
    } else if (places.length > 0 && incoming.length == 1) {
      //console.log(places);
      response = {
        "text": `The ${places[parseInt(incoming) - 1].name} is located at ${places[parseInt(incoming) - 1].address}`
      }
      // Sends the response message
      callSendAPI(sender_psid, response);
      places = [];
    }
  }
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}