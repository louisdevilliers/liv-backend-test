const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const jsforce = require('jsforce');
const readline = require('readline');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(bodyParser.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const INSTANCE_URL = process.env.INSTANCE_URL;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const username = process.env.SALESFORCE_USERNAME;
const password = process.env.SALESFORCE_PASSWORD;
const securityToken = process.env.SALESFORCE_SECURITY_TOKEN;
const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';

const oauth2 = new jsforce.OAuth2({
  loginUrl: 'https://login.salesforce.com',
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI
});
/*
function getConnection() {
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI
    },
    instanceUrl: INSTANCE_URL,
    refreshToken: REFRESH_TOKEN
  });

  // Handle token refresh
  conn.on("refresh", (accessToken, res) => {
    console.log("Access token refreshed:", accessToken);
    // Optionally update your stored access token
    // e.g., save the new access token to your database or environment
  });

  return conn;
}
*/
function getConnection(callback) {
  const conn = new jsforce.Connection({ loginUrl });
  conn.login(username, password + securityToken, (err, userInfo) => {
    if (err) {
      return callback(err, null);
    }
    callback(null, conn);
  });
}
//SHOPIFY APIS

const shopifyHeaders = {
  'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
  'Content-Type':'application/json'
};

// Endpoint to fetch products
app.get('/products', async (req, res) => {
  try {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/products.json`, {
      headers: shopifyHeaders,
      params: {
        fields: 'id,title,variants,created_at,body_html',
      }
    });
    console.log(response.data.products);
    res.json(response.data.products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/orders', async (req, res) => {
  //const { customerEmail } = req.query;
  const customerEmail = 'newzap@testmail.com';
  //const customerEmail = 'jack@testmail.com';

  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email is required' });
  }

  try {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json`, {
      headers: shopifyHeaders,
      params: {
        fulfillment_status: 'null', //null //fulfilled
        financial_status: 'pending', //pending //null en pending -> used for unfulf orders
        email: customerEmail,
        fields: 'id,email,financial_status,fulfillment_status,created_at,line_items',
      },
    });
    console.log(response.data.orders);
    res.json(response.data.orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

//SALESFORCE APIS
/*
app.get('/salesforce/accounts', async (req, res) => {
  const conn = getConnection();
  try {
    const result = await conn.query("SELECT Id, Name FROM Account LIMIT 10");
    console.log(result.records);
    res.json(result.records);
  } catch (error) {
    console.error('Error fetching data from Salesforce:', error);
    res.status(500).json({ error: 'Failed to fetch data from Salesforce' });
  }
});
*/

// PUT request to update an order
app.put('/orders/:id', async (req, res) => {
  const orderId = req.params.id;
  const orderData = {
    order: {
      id: orderId,
      financial_status:"pending",
    }
  };

  try {
    const response = await axios.put(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/orders/${orderId}.json`, 
      orderData,
      { headers: shopifyHeaders }
    );
    console.log(response.data.order);
    res.json(response.data.order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// PUT request to update an order
app.put('/orders/:id', async (req, res) => {
  const orderId = req.params.id;
  const transactionData = {"transaction":{"kind":"sale","parent_id":5075547193646}}

  try {
    const response = await axios.put(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/orders/${orderId}/transactions.json`, 
      transactionData,
      { headers: shopifyHeaders }
    );
    console.log(response.data.transaction);
    res.json(response.data.transaction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.get('/salesforce/accounts', (req, res) => {
  getConnection((err, conn) => {
    if (err) {
      console.error('Error logging into Salesforce:', err);
      return res.status(500).json({ error: 'Failed to log into Salesforce' });
    }
    conn.query('SELECT Id, Name FROM Account LIMIT 10', (err, result) => {
      if (err) {
        console.error('Error fetching data from Salesforce:', err);
        return res.status(500).json({ error: 'Failed to fetch data from Salesforce' });
      }
      res.json(result.records);
    });
  });
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



