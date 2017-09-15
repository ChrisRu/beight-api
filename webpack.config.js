const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const NodemonPlugin = require('nodemon-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const debug = process.env.NODE_ENV === 'development';

const config = {
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
        use: ['babel-loader', 'ts-loader', 'eslint-loader']
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
    })
  ],
  devtool: 'source-map',
  stats: {
    colors: true
  }
};

if (debug) {
  config.output.filename = 'index.js';
  config.devtool = '#eval-source-map';
  config.stats = {
    assets: false,
    colors: true,
    version: false,
    hash: false,
    timings: false,
    chunks: false,
    chunkModules: false
  };
  config.plugins.push(new NodemonPlugin());
} else {
  config.plugins.push(
    new UglifyJSPlugin({
      sourceMap: true,
      parallel: true,
      uglifyOptions: {
        ecma: 8
      }
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: false,
      options: {
        context: __dirname
      }
    })
  );
}

module.exports = config;
