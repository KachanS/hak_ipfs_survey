require('dotenv').config();
const { IPFS_SERVER, ROOT_DIR, ARAGON_ORG, ETH_NETWORK } = process.env;

const { utils: { isAddress, fromWei } } = require('web3');
const Web3 = require('web3');
const { connect } = require('@aragon/connect');
const { default: connectTokens } = require('@aragon/connect-tokens');
const createClient = require('ipfs-http-client')

let web3 = new Web3(
    new Web3.providers.WebsocketProvider("wss://rinkeby.infura.io/ws/v3/6ec291dd1fe540948986c1ce5267aafb")
);

const client = createClient(IPFS_SERVER || 'http://127.0.0.1:5002')

const validateNumber = (value, name) => {
    if (Number.isNaN(+value) || +value <= 0) {
        throw `Invalid "${name}" value`;
    }
};

const getProcessor = type => {
    if (type !== 'domain') {
        throw 'Unsupported survey type "'+type+'"';
    }

    return {
        canCreateSurvey: async address => {
            return ['0xb42c76567e0A1446B444E94657788Ba953D6fE66'].map(s => s.toLowerCase()).indexOf(address.toLowerCase()) !== -1;

            const org = await connect(ARAGON_ORG, 'thegraph', { network: +ETH_NETWORK });
            const tokens = await connectTokens(org.app('token-manager'))

            const holders = await tokens.holders();

            return holders.map(h => h.address).indexOf(address) !== -1;
        },
        getSurveyData: request => {
            const start = +request.start;
            const end = +request.end;
            const block = +request.block;
            const name = request.name;
            const token = request.token;
            const price = request.price;

            validateNumber(start, 'start');
            validateNumber(end, 'end');
            validateNumber(block, 'block');
            validateNumber(block, 'price');
            if (start >= end) {
                throw 'Start should be greater then end';
            }
            if (!name) {
                throw '"name" is required';
            }
            if (!isAddress(token)) {
                // Check if it is ERC20 contract
                throw '"token" should be valid ETH address';
            }

            return {
                start,
                end,
                block,
                token,
                name,
                price
            };
        },
    }
};

const validateSign = (address, data, sign) => {

};

module.exports = app => {
    app.namespace('/api', () => {
        app.get('/', async (req, res) => {
            res.json({
                result: true,
                version: '1.0'
            });
        });

        // List of surveys
        app.get('/survey', async (req, res) => {
            try {
                const dir = await client.files.ls(`/${ROOT_DIR}`);
                const surveys = [];

                for await (const entity of dir) {
                    const data = await client.files.read(`/${ROOT_DIR}/${entity.name}/info`);
                    let content = '';
                    for await (const row of data) {
                        content += row.toString();
                    }

                    try {
                        surveys.push(JSON.parse(content));
                    } catch (err) {
                        console.log('[E] parse survey data', err.toString());
                    }
                }

                res.json({
                    result: true,
                    surveys
                });
            } catch(err) {
                res.json({
                    result: false,
                    code: err.code || 0,
                    error: err.toString(),
                });
            }
        });

        // Create new survey
        app.post('/survey', async (req, res) => {
            try {
                const {type, address, data, sign} = req.body;
                const processor = getProcessor(type);
                const id = new Date().getTime();

                if (!(await processor.canCreateSurvey(address))) {
                    throw 'You can\'t create survey';
                }

                await validateSign(address, data, sign);

                const survey = await processor.getSurveyData(req.body);

                await client.files.mkdir(`/${ROOT_DIR}/${id}`);
                await client.files.write(`/${ROOT_DIR}/${id}/info`, JSON.stringify(survey), {create: true});

                res.json({
                    result: true,
                    survey: null
                });
            } catch(err) {
                res.json({
                    result: false,
                    code: err.code || 0,
                    error: err.toString(),
                });
            }
        });

        // Vote
        app.post('/survey/:id/vote', async (req, res) => {
            res.json({
                result: true,
                vote: null
            });
        });
    });
};