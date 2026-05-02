'use strict';

const path = require('node:path');

const projectRoot = __dirname;
const frontendDir = path.join(projectRoot, 'lib', 'frontend');
const backendDir = path.join(projectRoot, 'lib', 'backend');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  context: projectRoot,
  entry: {
    frontend: path.join(frontendDir, 'secondary-window.js'),
    'editor.worker': path.join(frontendDir, 'editor.worker.js')
  },
  output: {
    path: frontendDir,
    filename: '[name].bundle.js',
    clean: false
  },
  resolve: {
    extensions: ['.js', '.mjs', '.json']
  },
  infrastructureLogging: {
    level: 'error'
  },
  devServer: {
    host: '127.0.0.1',
    port: Number(process.env.SKYEQUANTA_IDE_WEBPACK_PORT || 3100),
    static: [
      {
        directory: frontendDir,
        watch: false
      },
      {
        directory: backendDir,
        publicPath: '/backend',
        watch: false
      }
    ],
    client: false,
    hot: false
  }
};
