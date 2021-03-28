require('dotenv').config();
const { IPFS_SERVER, ROOT_DIR, ARAGON_ORG, ETH_NETWORK, INFURA_URL } = process.env;

const { utils: { isAddress } } = require('web3');
const Web3 = require('web3');
const { connect } = require('@aragon/connect');
const { default: connectTokens } = require('@aragon/connect-tokens');
const createClient = require('ipfs-http-client')
const Erc20Abi = require('../erc20.abi.json');

let web3 = new Web3(
    new Web3.providers.WebsocketProvider(INFURA_URL)
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
        getSurveyData: (ts, request) => {
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
                price,
                isActive: ts >= start && ts <= end,
                id: ts
            };
        },
    }
};

const isValidateSign = (address, data, sign) => {
    const signer = web3.eth.accounts.recover(data, sign);

    return signer.toLowerCase() === address.toLowerCase();
};

const asyncGenToJson = async gen => {
    let content = '';
    for await (const row of gen) {
        content += row.toString();
    }

    return JSON.parse(content);
};

const getTokenBalance = async (survey, address) => {
    const contract = new web3.eth.Contract(Erc20Abi, survey.token);

    const decimals = await contract.methods.decimals().call();
    const rawBalance = await contract.methods.balanceOf(address).call({}, survey.block);

    return rawBalance * Math.pow(10, -1*decimals);
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

                const ts = new Date().getTime();

                for await (const entity of dir) {
                    const data = await client.files.read(`/${ROOT_DIR}/${entity.name}/info`);

                    try {
                        const survey = await asyncGenToJson(data);
                        surveys.push({
                            ...survey,
                            isActive: ts >= survey.start && ts <= survey.end,
                            id: entity.name,
                        });
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
                const { type, address, data, sign } = req.body;
                const processor = getProcessor(type);

                const ts = new Date().getTime();

                if (!(await processor.canCreateSurvey(address))) {
                    throw 'You can\'t create survey';
                }

                if (!(await isValidateSign(address, data.name, sign))) {
                    throw 'Invalid signature';
                }

                const survey = await processor.getSurveyData(ts, req.body);

                await client.files.mkdir(`/${ROOT_DIR}/${survey.id}`);
                await client.files.write(`/${ROOT_DIR}/${survey.id}/info`, JSON.stringify(survey), {create: true});

                res.json({
                    result: true,
                    survey
                });
            } catch(err) {
                res.json({
                    result: false,
                    code: err.code || 0,
                    error: err.toString(),
                });
            }
        });

        app.get('/survey/:id/can_vote', async (req, res) => {
            try {
                const { id } = req.params;
                const { address } = req.query;

                const data = await client.files.read(`/${ROOT_DIR}/${id}/info`);
                const survey = await asyncGenToJson(data);

                if (!survey) {
                    throw 'Survey not founded';
                }

                if (!survey.token) {
                    throw 'Invalid survey token';
                }

                if (!survey.block) {
                    throw 'Invalid survey block';
                }

                const balance = await getTokenBalance(survey, address);

                if (balance <= 0) {
                    throw `No funds on block "${survey.block}"`;
                }

                const ts = new Date().getTime();

                if (ts < survey.start || ts > survey.end) {
                    throw 'Survey isn\'t active';
                }

                res.json({
                    result: true,
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
            try {
                const { id } = req.params;
                const { address, sign } = req.query;

                const data = await client.files.read(`/${ROOT_DIR}/${id}/info`);
                const survey = await asyncGenToJson(data);

                if (!survey) {
                    throw 'Survey not founded';
                }

                if (!survey.token) {
                    throw 'Invalid survey token';
                }

                if (!survey.block) {
                    throw 'Invalid survey block';
                }

                const balance = await getTokenBalance(survey, address);

                if (balance <= 0) {
                    throw `No funds on block "${survey.block}"`;
                }

                const ts = new Date().getTime();

                if (ts < survey.start || ts > survey.end) {
                    throw 'Survey isn\'t active';
                }

                if (!(await isValidateSign(address, id, sign))) {
                    throw 'Invalid signature';
                }

                await client.files.mkdir(`/${ROOT_DIR}/${survey.id}`);
                await client.files.write(`/${ROOT_DIR}/${survey.id}/${address}`, JSON.stringify({ ts, address, sign }), {create: true});

                res.json({
                    result: true,
                });
            } catch(err) {
                res.json({
                    result: false,
                    code: err.code || 0,
                    error: err.toString(),
                });
            }
        });
    });
};