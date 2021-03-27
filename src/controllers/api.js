const { connect } = require('@aragon/connect');
const { default: connectTokens } = require('@aragon/connect-tokens');
const createClient = require('ipfs-http-client')

const client = createClient('http://127.0.0.1:5002')

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
            const dir = await client.files.ls('/test');
            const surveys = [];

            for await (const entity of dir) {
                const data = await client.files.read(`/test/${entity.name}/info`);
                let content = '';
                for await (const row of data) {
                    content += row.toString();
                }

                try {
                    surveys.push(JSON.parse(content));
                } catch(err) {
                    console.log('[E] parse survey data', err.toString());
                }
            }

            res.json({
                result: true,
                surveys
            });
        });

        // Create new survey
        app.post('/survey', async (req, res) => {
            res.json({
                result: true,
                survey: null
            });
        });

        // Vote
        app.post('/survey/:id/vote', async (req, res) => {
            res.json({
                result: true,
                vote: null
            });
        });

        app.get('/test', async (req, res) => {
            try {
                /*const org = await connect('ksstest.aragonid.eth', 'thegraph', { network: 4 });
                const tokens = await connectTokens(org.app('token-manager'))*/
                try {
                    await client.files.mkdir('/test');
                } catch(err) {
                    // Dir exists
                }

                const stats = await client.files.ls('/');
                res.json({
                    result: true,
                    //holders: await tokens.holders(),
                    stats,
                });
            } catch(err) {
                res.json({
                    result: false,
                    code: err.code || 0,
                    error: err.toString(),
                });
            }
        });

        app.get('/create', async (req, res) => {
            try {
                const { type = 'domain' } = req.query;

                const id = new Date().getTime();

                await client.files.mkdir(`/test/${id}`);
                await client.files.write(`/test/${id}/info`, JSON.stringify(req.query), { create: true });

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