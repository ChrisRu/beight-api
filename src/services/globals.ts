export interface language {
  name: string;
  languageName: string;
  type: string;
  extensions: string[];
  id: number;
}

export interface gameType {
  name: string;
  lineup: string[];
  id: number;
}

export interface globals {
  gameTypes: gameType[];
  languages: language[];
}

const globals: globals = {
  gameTypes: [
    {
      name: 'Classic',
      lineup: ['markup', 'styling', 'logic'],
      id: 1
    },
    {
      name: 'Zen Garden',
      lineup: ['styling'],
      id: 2
    },
    {
      name: 'Custom',
      lineup: [],
      id: 3
    }
  ],
  languages: [
    {
      name: 'HTML',
      languageName: 'html',
      type: 'markup',
      extensions: ['html', 'htm'],
      id: 1
    },
    {
      name: 'CSS',
      languageName: 'css',
      type: 'styling',
      extensions: ['css'],
      id: 2
    },
    {
      name: 'JavaScript',
      languageName: 'javascript',
      type: 'logic',
      extensions: ['js', 'es6'],
      id: 3
    },
    {
      name: 'SCSS',
      languageName: 'scss',
      type: 'styling',
      extensions: ['scss'],
      id: 4
    },
    {
      name: 'SASS',
      languageName: 'sass',
      type: 'styling',
      extensions: ['sass'],
      id: 5
    },
    {
      name: 'Stylus',
      languageName: 'stylus',
      type: 'styling',
      extensions: ['styl', 'stylus'],
      id: 6
    },
    {
      name: 'CoffeeScript',
      languageName: 'coffee',
      type: 'logic',
      extensions: ['coffee'],
      id: 7
    }
  ]
};

/**
* Get language info by identifier
* @param id Language identifier
* @returns Found Language
*/
export function getLanguage(id: number | string) {
  if (typeof id === 'number') {
    return globals.languages.find(lang => lang.id === id);
  }
  return globals.languages.find(lang => lang.name === id);
}

export default globals;
