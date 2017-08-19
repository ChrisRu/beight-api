import 'babel-polyfill';

const dotenvLocation = require('path').resolve(__dirname, '../.env');
require('dotenv').config({ path: dotenvLocation });

import './components/app';
import './components/router';
import './components/ws';
