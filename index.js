const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const MERCHANT_ID = "PGTESTPAYUAT";
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const SALT_INDEX = 1;
const SALT_KEY = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
const APP_BE_URL = "http://localhost:8080";

// Enable CORS
app.use(cors());
// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", 'http://localhost:4200');
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

// // Other middleware and configurations
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: false }));

// // Define the target URL of the external API server
// const target = 'http://localhost:4200';


// Create a proxy middleware instance
const proxyMiddleware = createProxyMiddleware({
  target: 'https://mercury-uat.phonepe.com',
  changeOrigin: true,
  pathRewrite: {
    '^/pay': '', // remove /pay prefix when forwarding the request
  },
});

// Use proxy middleware for routes that need to be forwarded
// app.use('/pay', proxyMiddleware);


// Define route for initiating payment
app.get("/pay", async function (req, res) {
  const amount = +req.query.amount;
  const userId = "MUID123";
  const merchantTransactionId = uniqid();
  
  const normalPayload = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: userId,
    amount: amount * 100,
    redirectUrl: `${APP_BE_URL}/payment/validate/${merchantTransactionId}`,
    redirectMode: "REDIRECT",
    mobileNumber: "9999999999",
    paymentInstrument: { type: "PAY_PAGE" },
  };

  const bufferObj = Buffer.from(JSON.stringify(normalPayload), "utf8");
  const base64EncodedPayload = bufferObj.toString("base64");

  const string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
  const sha256_val = sha256(string);
  const xVerifyChecksum = sha256_val + "###" + SALT_INDEX;
  console.log('inside trychatch');
  try {
  
    const response = await axios.post(
      `${PHONE_PE_HOST_URL}/pg/v1/pay`,
      { request: base64EncodedPayload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        },
      }
    );
    console.log(response.data); // Log the response to inspect its contents
    res.json(response.data.data.instrumentResponse.redirectInfo.url);
  } catch (error) {
    console.error(error); // Log any errors for debugging
    res.send(error);
  }
  
});

// Define route for checking payment status
app.get("/payment/validate/:merchantTransactionId", async function (req, res) {
  const { merchantTransactionId } = req.params;
  if (!merchantTransactionId) {
    return res.send("Sorry!! Error");
  }

  const statusUrl =
    `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/` + merchantTransactionId;

  const string =
    `/pg/v1/status/${MERCHANT_ID}/` + merchantTransactionId + SALT_KEY;
  const sha256_val = sha256(string);
  const xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

  try {
    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyChecksum,
        "X-MERCHANT-ID": merchantTransactionId,
        accept: "application/json",
      },
    });
    if (response.data && response.data.code === "PAYMENT_SUCCESS") {
      // res.send(response.data);
      return res.redirect(`http://localhost:4200/confirmation?success=true&data=${encodeURIComponent(JSON.stringify(response.data))}`);    } else {
      // Handle payment failure / pending status
    }
  } catch (error) {
    res.send(error);
  }
});

// Route for handling other requests
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

// Starting the server
const port = 8080;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});
