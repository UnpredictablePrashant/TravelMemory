const config = require('./default.json');
const envConfig = process.env.NODE_ENV === 'production'
  ? require('./production.json')
  : require('./dev.json');

const merged = { ...config, ...envConfig };

const secretVariable = {
  mongoUri: process.env.MONGO_URI,
  port: process.env.PORT || merged.backend.port,
  nodeEnv: process.env.NODE_ENV || merged.app.env,
  backendUrl: process.env.REACT_APP_BACKEND_URL || merged.frontend.backendUrl
};

module.exports = {
  ...merged,
  secrets: secretVariable
};
