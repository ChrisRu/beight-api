const path = require('path');
const debug = process.env.NODE_ENV === 'development';

const config = {
  target: 'node',
  entry: path.resolve(__dirname, 'src/index.ts'),
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: 'babel-loader'
      },
      {
        test: /\.tsx?$/,
        use: ['babel-loader', 'ts-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  }
};

if (debug) {
  config.devtool = '#inline-sourcemap';
}

module.exports = config;
