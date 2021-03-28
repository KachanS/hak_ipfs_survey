require('dotenv').config();
const { BASE_TOKEN } = process.env;

const { getTokenBalance, validateNumber, getCurrentBlock } = require('../common');

const isActive = async survey => {
    const curBlock = await getCurrentBlock();

    return survey.block > curBlock;
};

module.exports = {
    canCreateSurvey: async address => {
        const balance = await getTokenBalance(BASE_TOKEN, address);

        return balance > 0;
    },
    getSurveyData: async (ts, request) => {
        const block = +request.block;
        const options = request.options;
        const curBlock = await getCurrentBlock();

        validateNumber(block, 'block');

        if (block <= curBlock) {
            throw 'Block number should be in future';
        }

        if (!Array.isArray(options)) {
            throw '"options" should be array';
        }

        const survey = {
            block,
            token: BASE_TOKEN,
            options,
            id: ts
        };

        return { ...survey, isActive: isActive(survey) };
    },
    isValidValue: (survey, value) => {
        return typeof survey.options[value] !== 'undefined';
    },
    isActive,
    canVote: async (address, survey) => {
        const balance = await getTokenBalance(survey.token, address);

        return balance > 0;
    },
};