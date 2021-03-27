require('dotenv').config();
const express = require('express');
require('express-namespace');

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

const app = express();

const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

require('./controllers/api')(app);

//app.use('/', express.static('webroot'));
//app.get('*', (req, res) => { res.sendFile('index.html', { root: 'webroot' }) });
app.get('*', (req, res) => res.status(404).send('Not found'));

const port = process.env.APP_PORT || 1234;
app.listen(port, () => {
    console.log('Listening on port '+port);
});
