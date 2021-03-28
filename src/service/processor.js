const domainProcessor = require('./processor/domain');
const pollProcessor = require('./processor/poll');

module.exports = type => {
    switch (type) {
        case 'domain':
            return domainProcessor;
        case 'poll':
            return pollProcessor;
        default:
            throw 'Not implemeted';
    }
};