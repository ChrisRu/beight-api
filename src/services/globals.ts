const globals = {
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
      type: 'markup',
      extensions: ['html', 'htm'],
      id: 1
    },
    {
      name: 'CSS',
      type: 'styling',
      extensions: ['css'],
      id: 2
    },
    {
      name: 'JavaScript',
      type: 'logic',
      extensions: ['js', 'es6'],
      id: 3
    },
    {
      name: 'SCSS',
      type: 'styling',
      extensions: ['scss'],
      id: 4
    },
    {
      name: 'SASS',
      type: 'styling',
      extensions: ['sass'],
      id: 5
    },
    {
      name: 'Stylus',
      type: 'styling',
      extensions: ['styl', 'stylus'],
      id: 6
    },
    {
      name: 'CoffeeScript',
      type: 'logic',
      extensions: ['coffee'],
      id: 7
    }
  ]
};

export default globals;
