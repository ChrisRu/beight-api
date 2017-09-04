const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

const debug = process.env.NODE_ENV === 'development';

const config = {
  target: 'node',
  entry: path.resolve(__dirname, 'src/index.ts'),
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    hotUpdateChunkFilename: 'hot/hot-update.js',
    hotUpdateMainFilename: 'hot/hot-update.json'
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
      },
      {
        test: /\.json$/,
        use: 'json-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  externals: [nodeExternals()],
  plugins: [
    new webpack.BannerPlugin({
      banner: 'require("source-map-support").install();',
      raw: true,
      entryOnly: false
    })
  ]
};

if (debug) {
  config.devtool = '#eval-source-map';
}

module.exports = config;
