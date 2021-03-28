require('dotenv').config();
const { ARAGON_ORG, ETH_NETWORK, BASE_TOKEN } = process.env;
const { utils: { isAddress } } = require('web3');

const { connect } = require('@aragon/connect');
const { default: connectTokens } = require('@aragon/connect-tokens');
const { getTokenBalance, validateNumber } = require('../common');

module.exports = {
    canCreateSurvey: async address => {
        const balance = await getTokenBalance(BASE_TOKEN, address);

        return balance > 0;

        /*const org = await connect(ARAGON_ORG, 'thegraph', { network: +ETH_NETWORK });
        const tokens = await connectTokens(org.app('token-manager'))

        const holders = await tokens.holders();

        return holders.map(h => h.address).indexOf(address) !== -1;*/
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
    isValidValue: (survey, value) => {
        return [0, 1].indexOf(+value) !== -1;
    },
    isActive: survey => {
        const ts = new Date().getTime();

        return (ts >= survey.start) && (ts <= survey.end);
    },
    canVote: async (address, survey) => {
        const balance = await getTokenBalance(survey.token, address, survey.block);

        return balance > 0;
    },
};