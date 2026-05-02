
module.exports = {
  getTemplate: () => ({ endpointMode: 'chat' }),
  setTemplate: (next) => ({ endpointMode: next?.endpointMode || 'chat' }),
};
