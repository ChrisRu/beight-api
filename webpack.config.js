const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const NodemonPlugin = require('nodemon-webpack-plugin');
const HappyPack = require('happypack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const debug = process.env.NODE_ENV === 'development';

const config = {
  context: __dirname,
  target: 'node',
  entry: path.resolve(__dirname, 'src/index.ts'),
  output: {
    filename: 'index-[hash].js',
    path: path.resolve(__dirname, 'dist'),
    hotUpdateChunkFilename: 'hot/hot-update.js',
    hotUpdateMainFilename: 'hot/hot-update.json'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        include: path.resolve(__dirname, 'src'),
        use: ['babel-loader', 'eslint-loader']
      },
      {
        test: /\.tsx?$/,
        include: path.resolve(__dirname, 'src'),
        use: 'happypack/loader?id=ts'
      },
      {
        test: /\.json$/,
        include: path.resolve(__dirname, 'src'),
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
    }),
    new webpack.optimize.UglifyJsPlugin({
      exclude: /.+?/,
      sourcemap: true
    }),
    new ForkTsCheckerWebpackPlugin({
      checkSyntacticErrors: true
    }),
    new HappyPack({
      id: 'ts',
      loaders: [
        'babel-loader',
        {
          path: 'ts-loader',
          query: {
            happyPackMode: true,
            transpileOnly: true
          }
        },
        'eslint-loader'
      ]
    })
  ],
  devtool: 'source-map',
  stats: {
    assets: false,
    colors: true,
    version: false,
    hash: false,
    timings: false,
    chunks: false,
    chunkModules: false
  }
};

if (debug) {
  config.output.filename = 'index.js';
  config.devtool = '#eval-source-map';
  config.plugins.push(new NodemonPlugin());
}

module.exports = config;
