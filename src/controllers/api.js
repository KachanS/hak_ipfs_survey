require('dotenv').config();
const { IPFS_SERVER, ROOT_DIR } = process.env;

const Web3 = require('web3');
const createClient = require('ipfs-http-client')
const { getTokenBalance, isValidSign, asyncGenToJson } = require('../service/common');
const getProcessor = require('../service/processor');

const client = createClient(IPFS_SERVER || 'http://127.0.0.1:5002')

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
                        const processor = getProcessor(survey.type);
                        surveys.push({
                            ...survey,
                            isActive: await processor.isActive(survey),
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

                if (!(await isValidSign(address, data.name, sign))) {
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

                const processor = getProcessor(survey.type);

                if (!(await processor.isActive(survey))) {
                    throw 'Survey isn\'t active';
                }

                if (!(await processor.canVote(address, survey))) {
                    throw 'You can\'t vote';
                }

                res.json({
                    result: true,
                });
            } catch(err) {
                console.log('[E] CanVote', err);
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
                const { address, sign, value } = req.query;

                const data = await client.files.read(`/${ROOT_DIR}/${id}/info`);
                const survey = await asyncGenToJson(data);

                if (!survey) {
                    throw 'Survey not founded';
                }

                const processor = getProcessor(survey.type);

                if (!(await isValidSign(address, id, sign))) {
                    throw 'Invalid signature';
                }

                if (!(await processor.isActive(survey))) {
                    throw 'Survey isn\'t active';
                }

                if (!(await processor.canVote(address, survey))) {
                    throw 'You can\'t vote';
                }

                if (!(await processor.isValidValue(survey, value))) {
                    throw `Invalid value "${value}"`;
                }

                await client.files.mkdir(`/${ROOT_DIR}/${survey.id}`);
                await client.files.write(`/${ROOT_DIR}/${survey.id}/${address}`, JSON.stringify({ ts, address, sign, value }), {create: true});

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