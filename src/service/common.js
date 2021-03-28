require('dotenv').config();
const { INFURA_URL } = process.env;

const Web3 = require('web3');
const Erc20Abi = require('../erc20.abi.json');

const web3 = new Web3(
    new Web3.providers.WebsocketProvider(INFURA_URL),
);

const getTokenBalance = async (token, address, block = 'latest') => {
    const contract = new web3.eth.Contract(Erc20Abi, token);

    const decimals = await contract.methods.decimals().call();
    const rawBalance = await contract.methods.balanceOf(address).call({}, block);

    return rawBalance * Math.pow(10, -1*decimals);
};

const isValidSign = (address, data, sign) => {
    const signer = web3.eth.accounts.recover(data, sign);

    return signer.toLowerCase() === address.toLowerCase();
};

const getCurrentBlock = web3.eth.getBlockNumber;

const asyncGenToJson = async gen => {
    let content = '';
    for await (const row of gen) {
        content += row.toString();
    }

    return JSON.parse(content);
};

const validateNumber = (value, name) => {
    if (Number.isNaN(+value) || +value <= 0) {
        throw `Invalid "${name}" value`;
    }
};

module.exports = {
    getTokenBalance,
    isValidSign,
    asyncGenToJson,
    validateNumber,
    getCurrentBlock,
};